import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { User as UserEntity } from '.prisma/client';
import { Friendship, GameState } from '@prisma/client';
import { toSafeUser } from './user.utils';
import * as AuthUtils from '../auth/auth.utils';

import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { Response } from 'express'; // Add this import
import { CustomRequest } from './users.controller';
import { AuthService } from 'src/auth/auth.service';

@Injectable()
export class UsersService {
	httpService: any;
  constructor(private prisma: PrismaService) { }

  async create(data: CreateUserDto) {

    const newUser = await this.prisma.user.create({ data });
    return newUser;
  }

  async findAll() {
    const users = await this.prisma.user.findMany();

    return users.map(toSafeUser);
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { 
        id 
      },
      include: {
        following: true,
        followers: true,
      },
    });

    if (!user)
      return null;
    // delete user.password;
    return toSafeUser(user);
  }

  async update(id: number, updateUserDto: UpdateUserDto) {

    if (updateUserDto.name)
    {

      const existUser = await this.prisma.user.findUnique({
        where: {
          name: updateUserDto.name 
        },
      });

      if (existUser)
        throw new HttpException('Name already in use', 409);

        // throw new ('Name already in use');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });

    return toSafeUser(updatedUser);
  }

  async remove(id: number) {

    const deletedUser = await this.prisma.user.delete({ where: { id } });
    return toSafeUser(deletedUser);
    
  }

  async addFriend(id: number, followingId: number) {

    if (id === followingId) {
      throw new BadRequestException('A user cannot be friends with themselves.');
    }
  
    const user = await this.prisma.user.findUnique({ where: { id: id } });
    const friend = await this.prisma.user.findUnique({ where: { id: followingId } });
   
    const existingFriendship = await this.prisma.friendship.findFirst({
      where: {
        followingId: followingId,
        followerId: id,
      },
    });

	const existingBlock = await this.prisma.block.findFirst({
		where: {
			MyId: id,
			blockedId: followingId,
		},
	});
  
    if (existingFriendship) {
      throw new BadRequestException('Friendship already exists.');
    }

	if (existingBlock) {
		throw new BadRequestException('User is block, can\'t add as friend!');
	}

    const friendship = await this.prisma.friendship.create({
      data: {
        followerId: user.id,
        followingId : friend.id,
      },
      include: {
        following: true,
        followers: true
      }
    });

    return toSafeUser(friendship.following);

  }

  async removeFriend(id: number, followerId: number) {

  
    const user = await this.prisma.user.findUnique({ where: { id: id } });
    const friend = await this.prisma.user.findUnique({ where: { id: followerId } });
   
    const existingFriendship = await this.prisma.friendship.findFirst({
      where: {
		followingId: followerId,
		followerId: id,
      },
    });
  
    if (!existingFriendship) {
      throw new BadRequestException('Cannot remove user from friend list since its not your friend.');
    }

    await this.prisma.friendship.delete({
        where: {
          id: existingFriendship.id,
        },
    });

    return this.showFriends(id);

  }

  async showFriends(id: number) {
  
    const user = await this.prisma.user.findUnique({ where: { id: id } });

    const existingFriendships = await this.prisma.friendship.findMany({
      where: {
        followerId: id,
      },
      include: {
        following: true,
        // followers: true,
      },
    });

    const friendsList = existingFriendships.map((friendship) => friendship.following);

    return friendsList.map(toSafeUser);
  }

  async blockUser(id: number, blockId: number) {

    if (id === blockId) {
      throw new BadRequestException('A user cannot block itself.');
    }
  
    const user = await this.prisma.user.findUnique({ where: { id: id } });
    const toBlock = await this.prisma.user.findUnique({ where: { id: blockId } });
   
    const existingFriendship = await this.prisma.friendship.findFirst({
      where: {
        followerId: id,
        followingId: blockId,
      },
    });

	const existingBlock = await this.prisma.block.findFirst({
		where: {
			MyId: id,
			blockedId: blockId,
		},
	});
  
    if (existingFriendship) {
      this.removeFriend(id, blockId);
    }

	if (existingBlock) {
		throw new BadRequestException('User is already block');
	}

    const block = await this.prisma.block.create({
      data: {
        blockedId: toBlock.id,
        MyId : user.id,
      },
      include: {
        blocked: true,
        // haters: true
      }
    });

    return toSafeUser(block.blocked);

  }

  async unblockUser(id: number, blockedId: number) {
  
    const user = await this.prisma.user.findUnique({ where: { id: id } });
    const friend = await this.prisma.user.findUnique({ where: { id: blockedId } });
   
    const existingBlocking = await this.prisma.block.findFirst({
      where: {
        MyId: id,
        blockedId: blockedId,
      },
    });
  
    if (!existingBlocking) {
      throw new BadRequestException('Cannot unblock user who has not been blocked.');
    }

    await this.prisma.block.delete({
        where: {
          id: existingBlocking.id,
        },
    });

    return this.showBlockedUsers(id);

  }

  async showBlockedUsers(id: number) {
  
    const blockings = await this.prisma.block.findMany({
      where: {
        MyId: id,
      },
      include: {
        blocked: true,
        // haters: true,
      },
    });

    const blockedUsers = blockings.map((block) => block.blocked);

    return blockedUsers.map(toSafeUser);
  }

  async showHaters(id: number) {
  
    const blockings = await this.prisma.block.findMany({
      where: {
        blockedId: id,
      },
      include: {
        // blocked: true,
        haters: true,
      },
    });

    const haters = blockings.map((hater) => hater.haters);

    return haters.map(toSafeUser);
  }

  async showCommunity(id: number) {

    const blocked = await this.showBlockedUsers(id);
	const haters = await this.showHaters(id);

    const blockedUserIds = blocked.map((block) => block.id);
	const hatersUserIds = haters.map((hater) => hater.id);

    const community = await this.prisma.user.findMany({
      where: {
        id: { notIn: [...blockedUserIds, ...hatersUserIds, id] },
      },
    });
    
    return community.map(toSafeUser);
  }

  async uploadAvatar(id: number, avatarPath: string) {
    const user = await this.prisma.user.findUnique({ where: { id: id } });
  
    if (!user) {
      throw new NotFoundException(`User with ${id} does not exist.`);
    }
  
    
    return this.prisma.user.update({
      where: { id: id },
      data: { avatar: avatarPath },
    });
  }

  async updateWinsMatch(id: number, winsMatch: number) {
	const user = await this.prisma.user.findUnique({ where: { id: id } });

	if (!user) {
		throw new NotFoundException(`User with ${id} does not exist.`);
	}

	return this.prisma.user.update({
		where: { id: id },
		data: { wins: winsMatch },
	});
  }

//   async updatePlayerStatus(id: number) {
// 	const user = await this.prisma.user.findUnique({ where: { id: id } });

// 	if (!user) {
// 		throw new NotFoundException(`User with id ${id} does not exist.`);
// 	}

// 	return this.prisma.user.update({
// 		where: { id: id },
// 		data: { state}
// 	})
//   }

  async seeUserGames(id: number) {
    const games = await this.prisma.game.findMany({
        where: {
			players: {
				some: {
				  userId: id
				}
			},
      state: GameState.FINISHED,
        },
        include: {
		  players: true,
        },
    });
    
    return games;
}

async logout(req: CustomRequest)
{
	const userId = parseInt(req.userId);
	const user = await this.prisma.user.findUnique({ where: { id: userId } });
	if (!user)
		throw new NotFoundException(`User with ${req.userId} does not exist.`);
	await this.prisma.user.update({
		where: { id: userId },
		data: { 
			token: "",
			status: 0
		},
	});
    return {
      accessToken: '',
    };
  }

  async getWins(id: number) {
    const user = await this.prisma.user.findUnique({
        where: { id : id },
    });

	if (!user) {
		throw new NotFoundException(`User with ${id} does not exist.`);
	}
    
    return user.wins;
  }

  async  getTwoFactor(req: CustomRequest)
  {
	const userId = parseInt(req.userId);
	const user = await this.prisma.user.findUnique({ where: { id: userId } });
	if (!user)
		throw new NotFoundException(`User with ${req.userId} does not exist.`);
	
	const secretCode = speakeasy.generateSecret({
		name: `loliloliPong (${user.login})`,
	});

	await this.prisma.user.update({
		where: { id: userId },
		data: { secert: secretCode.base32 },
	});

	return {
		otpauthUrl: secretCode.otpauth_url,
		base32: secretCode.base32,
	};
  }

  async verifyTwoFactor(req: CustomRequest, code: string)
  {
    const userId = parseInt(req.userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
    	throw new NotFoundException(`User with ${req.userId} does not exist.`);
	const verified = AuthUtils.verifyTwoFactor(code, user.secert);
	if (verified)
	{
		await this.prisma.user.update({
			where: { id: userId },
			data: { doubleAuth: true },
		});
	}
    return {
      	result: verified,
    };
  }

  async disableTwoFactor(req: CustomRequest)
  {
    const userId = parseInt(req.userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
    	throw new NotFoundException(`User with ${req.userId} does not exist.`);
    await this.prisma.user.update({
		where: { id: userId },
		data: { doubleAuth: false },
    });
    return {
      	result: true,
    };
  }

  public async pipeQrCodeStream(stream: Response, otpauthUrl: string)
  {
    return QRCode.toFileStream(stream, otpauthUrl);
  }
  
}
