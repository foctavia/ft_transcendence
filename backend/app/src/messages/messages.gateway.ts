import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, NotFoundException, Logger } from '@nestjs/common';
import { OnGatewayInit, WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Socket, Server, Namespace } from 'socket.io';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessageEntity } from './entities/message.entity';
import { GamesGateway } from '../games/games.gateway';
import { CreateChannelDto } from 'src/channels/dto/create-channel.dto';
import { ChannelsService } from 'src/channels/channels.service';
import * as jwt from 'jsonwebtoken';

interface JwtPayload
{
	userId: string;
	accessToken: string;
}
@WebSocketGateway({ namespace: '/chat', cors: '*' })
export class MessagesGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(MessagesGateway.name);

  constructor(private readonly messagesService: MessagesService, private readonly channelsService: ChannelsService, private prisma: PrismaService) {}

  @WebSocketServer() io: Namespace;
  @WebSocketServer() server: Server

  private onlineUsers: { [userId: number]: string } = {};

  afterInit(): void {
    this.logger.log(`Websocket chat gateway initialized.`);

	GamesGateway.eventEmitter.on('gameInvitation', async ({ senderId, receiverId, link }) => {
		// console.log('in event emitter');

		const sender = await this.prisma.user.findUnique({ where: { id: senderId } });
		if (!sender) {
			throw new NotFoundException(`User with ${senderId} does not exist.`);
		}

		let channel = await this.prisma.channel.findFirst({
			where: {
				name: "private",
				members: {
					every: {
						userId: {
							in: [senderId, receiverId]
						}
					},
				},
			},
		});

		
		if (!channel) {
			const membersData = [
				{
					userId: senderId,
				},
				{
					userId: receiverId,
				}
			]

			const createChannelDto: CreateChannelDto = {
				name: "private", 
				members: membersData,
				creatorId: senderId
			}
			channel = await this.channelsService.create(createChannelDto);

			const receiverSocketId = this.onlineUsers[receiverId];
			this.io.to(receiverSocketId).emit('join', channel.id.toString());
		}

		setTimeout(() => {
			if (channel) {
				// console.log('in message gateway, channel exists: ', channel);
				this.handleMessage(receiverId, {
				content: `${sender.name} has invited you to a game! Click the link bellow>${link}`,
				channelId: channel.id,
				senderId: senderId,
				});
			}
		}, 1000);
	});
  }

  async handleConnection(client: Socket) {

    client.on('user_connected', async (userId: number, token: string) => {
		if (!token) 
			return client.disconnect();
		else
		{
			try 
			{
				const decodedToken = await jwt.verify(token, `${process.env.NODE_ENV}`) as JwtPayload;
				const userId = decodedToken.userId;
				const user = await this.prisma.user.findFirst({ where: { id: parseInt(userId) }});
				if (!user)
					return client.disconnect();
				} catch (error) {
					return client.disconnect();
				}
			// console.log(`User ${userId} is connected in messages gateway with token ${token}`);
			this.onlineUsers[userId] = client.id;
		}

    //   console.log('User connected: ', userId);
    });

    client.on('disconnect', () => {
      const userToDisconnect = Object.keys(this.onlineUsers).find(key => this.onlineUsers[key] === client.id);
      if (userToDisconnect) {
        delete this.onlineUsers[userToDisconnect];
        // console.log('User disconnected: ', userToDisconnect);
      }
    });
  }

  @SubscribeMessage('join')
  async handleJoin(client: Socket, channelId: number) {
	client.join(channelId.toString());
	// const receiverSocketId = this.onlineUsers[receiver.userId];
	// this.io.to(channelId.toString()).emit('userJoined', client.id);
  }
  
  @SubscribeMessage('message')
  async handleMessage(client: Socket, message: { 
				content: string,
				channelId: number,
				senderId: number }): Promise<void> {
		const chan = await this.prisma.channel.findUnique({
			where: {id: message.channelId}
		});

		if (!chan)
			return ;
		
		const existingMessages = await this.prisma.message.findMany({
			where: {
				channelId: message.channelId
			}
		});

		const isFirstMessage = existingMessages.length === 0;

		const newMessage = await this.prisma.message.create({
			data: {
				senderId: message.senderId,
				content: message.content,
				channelId: message.channelId
			}
		});

		if (isFirstMessage) {
			const channelMembers = await this.prisma.channelMembership.findMany({
				where: {
					channelId: message.channelId
				}
			});

			const receiver = channelMembers.find(member => member.userId !== message.senderId);

			if (receiver) {
				const receiverSocketId = this.onlineUsers[receiver.userId];
				this.io.to(receiverSocketId).emit('join', message.channelId.toString());
			}
		}
		this.io.in(message.channelId.toString()).emit('message', newMessage);
	}

	@SubscribeMessage('createJoin')
		async makeInstantJoin(@ConnectedSocket() client: Socket, 
		@MessageBody() data: { 
			receiverId: number, 
			channelId: number}) {
		const receiverSocketId = this.onlineUsers[data.receiverId];
		// console.log('emitting join to user ', data.receiverId.toString());
		this.io.to(receiverSocketId).emit('join', data.channelId.toString());
	}
  
	@SubscribeMessage('chatDeleted')
	async handleChatDeletion(@ConnectedSocket() client: Socket, 
							@MessageBody() data: { 
								chatId: number, 
								userId: number
							}): Promise<void> {
	  client.broadcast.emit('chatDeleted', data);
	}

	@SubscribeMessage('kickUser')
	async handleKickUser(@ConnectedSocket() client: Socket, 
							@MessageBody() data: { 
								channelId: number, 
								userId: number
							}): Promise<void> {
		// console.log('in message gateway, received kickUser of user ', data.userId, 'from channel: ', data.channelId);
		const kickedSocketId = this.onlineUsers[data.userId];
		this.io.to(kickedSocketId).emit('handleKick', data.channelId.toString());
		this.io.in(data.channelId.toString()).emit('handleRemoveMember', data);
		// client.broadcast.emit('chatDeleted', data);
	}

	@SubscribeMessage('addAdmin')
	async handleAddAdmin(@ConnectedSocket() client: Socket, 
							@MessageBody() data: { 
								channelId: number, 
								userId: number
							}): Promise<void> {
		// console.log('in message gateway, received add admin of user ', data.userId, 'from channel: ', data.channelId);
		this.io.in(data.channelId.toString()).emit('handleAddAdmin', data);
	}

	@SubscribeMessage('removeAdmin')
	async handleRemoveAdmin(@ConnectedSocket() client: Socket, 
							@MessageBody() data: { 
								channelId: number, 
								userId: number
							}): Promise<void> {
		// console.log('in message gateway, received remove admin of user ', data.userId, 'from channel: ', data.channelId);
		this.io.in(data.channelId.toString()).emit('handleRemoveAdmin', data);
	}

	@SubscribeMessage('addMuted')
	async handleAddMuted(@ConnectedSocket() client: Socket, 
							@MessageBody() data: { 
								channelId: number, 
								userId: number
							}): Promise<void> {
		// console.log('in message gateway, received add muted of user ', data.userId, 'from channel: ', data.channelId);
		this.io.in(data.channelId.toString()).emit('handleAddMuted', data);
	}

	@SubscribeMessage('removeMuted')
	async handleRemoveMuted(@ConnectedSocket() client: Socket, 
							@MessageBody() data: { 
								channelId: number, 
								userId: number
							}): Promise<void> {
		// console.log('in message gateway, received remove muted of user ', data.userId, 'from channel: ', data.channelId);
		this.io.in(data.channelId.toString()).emit('handleRemoveMuted', data);
	}

	@SubscribeMessage('handleJoinGroup')
	async handleJoinGroup(@ConnectedSocket() client: Socket, @MessageBody() data: { channelId: number, userId: number }): Promise<void> {
		// console.log('In message gateway, user ', data.userId, ' just joined:', data.channelId);

		const channel = await this.prisma.channel.findUnique({
			where: { id: data.channelId },
			include: { members: true },
		});

		if (!channel) {
			return;
		}

		const returnedData = {
			channelId: data.channelId,
			updatedMembers: channel.members, 
		}

		this.io.to(data.channelId.toString()).emit('userJoined', returnedData);
	}

	@SubscribeMessage('messageDeleted')
	async handleMessageDeletion(@ConnectedSocket() client: Socket, 
							@MessageBody() data: { 
								message: {
									id: number,
									createdAt: string,
									content: string,
									channelId: number,
									senderId: number }, 
								userId: number
							}): Promise<void> {
		// console.log(' in message gateway, about to delete message: ', data.message.content);
		this.io.in(data.message.channelId.toString()).emit('messageDeleted', data.message);
	// client.broadcast.emit('messageDeleted', data.message);
	}

}

