import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, NotFoundException, UseGuards, UseInterceptors, UploadedFile, Res, ParseFilePipeBuilder, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UserEntity } from './entities/user.entity';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddFriendDto } from './dto/add-friend.dto';
import { BlockingDto } from './dto/blocking.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Express } from 'express'
import { toSafeUser } from './user.utils';

@Controller('users') @ApiTags('users')
export class UsersController {
  constructor(private readonly usersService: UsersService, private prisma: PrismaService) {}

	@Post()
	@ApiCreatedResponse({ type: UserEntity })
	create(@Body() createUserDto: CreateUserDto) {
		return this.usersService.create(createUserDto);
	}

	@Get()
	// @UseGuards(JwtAuthGuard)
	// @ApiBearerAuth()
	@ApiOkResponse({ type: UserEntity, isArray: true })
	findAll() {
    	return this.usersService.findAll();
  }

	@Get(':id')
	// @UseGuards(JwtAuthGuard)
	// @ApiBearerAuth()
	@ApiOkResponse({ type: UserEntity })
	async findOne(@Param('id', ParseIntPipe) id: number) {
		const user = await this.usersService.findOne(id);
		if (!user)
			throw new NotFoundException(`User with ${id} does not exist.`);
		return user;	
  }
  
	@Patch(':id')
	// @UseGuards(JwtAuthGuard)
	// @ApiBearerAuth()
	@ApiOkResponse({ type: UserEntity })
	async update(@Param('id', ParseIntPipe) id: number, @Body() updateUserDto: UpdateUserDto) {

		const user = await this.usersService.findOne(id);
		if (!user)
			throw new NotFoundException(`User with ${id} does not exist.`);
		
		return this.usersService.update(id, updateUserDto);
	}
	
	@Delete(':id')
	// @UseGuards(JwtAuthGuard)
	// @ApiBearerAuth()
	@ApiOkResponse({ type: UserEntity })
	remove(@Param('id', ParseIntPipe) id: number) {
    	return this.usersService.remove(id);
	}

	@Patch(':id/add-friend')
	// @UseGuards(JwtAuthGuard)
	// @ApiBearerAuth()
	@ApiOkResponse({ type: UserEntity })
	async addFriend(@Param('id', ParseIntPipe) id: number, @Body() addFriendDto: AddFriendDto) {
		const user = await this.usersService.findOne(id);
		if (!user)
			throw new NotFoundException(`User with ${id} does not exist.`);

		const friendId = addFriendDto.friendId;
		const friend = await this.usersService.findOne(friendId);
		if (!friend)
			throw new NotFoundException(`Friend with ${friendId} does not exist.`);

		return this.usersService.addFriend(id, friendId);
	}

	@Patch(':id/remove-friend')
	// @UseGuards(JwtAuthGuard)
	// @ApiBearerAuth()
	@ApiOkResponse({ type: UserEntity })
	async removeFriend(@Param('id', ParseIntPipe) id: number, @Body() addFriendDto: AddFriendDto) {
		const user = await this.usersService.findOne(id);
		if (!user)
			throw new NotFoundException(`User with ${id} does not exist.`);

		const friendId = addFriendDto.friendId;
		const friend = await this.usersService.findOne(friendId);
		if (!friend)
			throw new NotFoundException(`Friend with ${friendId} does not exist.`);

		return this.usersService.removeFriend(id, friendId);
	}

	@Get(':id/show-friends')
	// @UseGuards(JwtAuthGuard)
	// @ApiBearerAuth()
	@ApiOkResponse({ type: UserEntity })
	async showFriends(@Param('id', ParseIntPipe) id: number) {
		const user = await this.usersService.findOne(id);
		if (!user)
			throw new NotFoundException(`User with ${id} does not exist.`);

		return this.usersService.showFriends(id);
	}

	@Patch(':id/block-user')
	// @UseGuards(JwtAuthGuard)
	// @ApiBearerAuth()
	@ApiOkResponse({ type: UserEntity })
	async blockUser(@Param('id', ParseIntPipe) id: number, @Body() blockingDto: BlockingDto) {
		const user = await this.usersService.findOne(id);
		if (!user)
			throw new NotFoundException(`User with ${id} does not exist.`);

		const blockedId = blockingDto.blockedId;
		const toBlock = await this.usersService.findOne(blockedId);
		if (!toBlock)
			throw new NotFoundException(`User with ${blockedId} does not exist.`);

		return this.usersService.blockUser(id, blockedId);
	}

	@Patch(':id/unblock-user')
	// @UseGuards(JwtAuthGuard)
	// @ApiBearerAuth()
	@ApiOkResponse({ type: UserEntity })
	async unblockUser(@Param('id', ParseIntPipe) id: number, @Body() blockingDto: BlockingDto) {
		const user = await this.usersService.findOne(id);
		if (!user)
			throw new NotFoundException(`User with ${id} does not exist.`);

		const blockedId = blockingDto.blockedId;
		const toUnblock = await this.usersService.findOne(blockedId);
		if (!toUnblock)
			throw new NotFoundException(`User with ${blockedId} does not exist.`);

		return this.usersService.unblockUser(id, blockedId);
	}

	@Get(':id/show-blocked-users')
	// @UseGuards(JwtAuthGuard)
	// @ApiBearerAuth()
	@ApiOkResponse({ type: UserEntity })
	async seeBlockedUsers(@Param('id', ParseIntPipe) id: number) {
		const user = await this.usersService.findOne(id);
		if (!user)
			throw new NotFoundException(`User with ${id} does not exist.`);

		return this.usersService.showBlockedUsers(id);
	}

	@Get(':id/show-community')
	// @UseGuards(JwtAuthGuard)
	// @ApiBearerAuth()
	@ApiOkResponse({ type: UserEntity })
	async showCommunity(@Param('id', ParseIntPipe) id: number) {
		const user = await this.usersService.findOne(id);
		if (!user)
			throw new NotFoundException(`User with ${id} does not exist.`);

		return this.usersService.showCommunity(id);
	}

	@Post(':id/avatar')
	// @UseGuards(JwtAuthGuard)
	// @ApiBearerAuth()
	@UseInterceptors(FileInterceptor('file'))
	async uploadFile(
		@Param('id', ParseIntPipe) id: number,
		@UploadedFile(
			new ParseFilePipeBuilder()
				.addFileTypeValidator({
				fileType: 'jpeg',
				})
				.build({
				errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY
			}),
		) file: Express.Multer.File) {
			
		console.log(file);
	}

	@Get(':imgpath')
	seeUploadedFile(@Param('imgpath') image, @Res() res) {
		
		return res.sendFile(image, { root: './uploads' });
	}
	
}
