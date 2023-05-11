import { Block, Friendship, User } from '@prisma/client';

import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';

export class UserEntity implements User {
	@ApiProperty()
	id: number;

	@ApiProperty()
	name: string;

	@ApiProperty()
	email: string;

	@ApiHideProperty()
	password: string;

	@ApiProperty()
	avatar: string;

	// @ApiProperty({ required: false })
	// friends?: Friendship[];

	// @ApiProperty({ required: false })
	// blocked?: Block[];
	
}