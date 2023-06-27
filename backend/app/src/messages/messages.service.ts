import { Injectable } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateChannelDto, CreateChannelMembershipDto } from 'src/channels/dto/create-channel.dto';

@Injectable()
export class MessagesService {
	constructor(private prisma: PrismaService) { }
	
	async create(createMessageDto: CreateMessageDto) {

		const newMessage = await this.prisma.message.create({ 
			data: {
				...createMessageDto,
		  	},
		});

		return newMessage;
	}

	async findAll () {
		return await this.prisma.message.findMany();
	}

	findOne(id: number) {
		return `This action returns a #${id} message`;
	}

	update(id: number, updateMessageDto: UpdateMessageDto) {
		return `This action updates a #${id} message`;
	}

	async remove(id: number) {
		return await this.prisma.message.delete({ where: { id } });
	}

	async createChannel(createChannelDto: CreateChannelDto) {
		const { creatorId, name, members } = createChannelDto;

		if (members.length < 2) {
			throw new Error("Invalid channel creation request: must include at least two members.");
		}
	  
		const channel = await this.prisma.channel.create({
			data: {
				creatorId,
				name,
				members: {
					create: members.map((member) => ({ userId: member.userId })),
				},
			},
				include: {
				messages: true,
				members: true,
			},
		});
	  
		return channel;
	}

}
