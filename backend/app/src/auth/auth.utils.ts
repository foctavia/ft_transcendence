import * as speakeasy from 'speakeasy';
import * as jwt from 'jsonwebtoken';
import * as CryptoJS from 'crypto-js';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from './../prisma/prisma.service';


export function verifyTwoFactor(
	code: string,
	secert: string
) {
	if (!code)
		throw new BadRequestException(`Code is missing.`);
	const DIGIT_EXPRESSION: RegExp = /^\d$/;
	const isDigit = (character: string): boolean => {
		return character && DIGIT_EXPRESSION.test(character);
	};

	for (let i = 0; i < code.length; i ++)
	{
		if (isDigit(code[i]) === false)
			throw new BadRequestException(`Code is not a number.`);
	}
	
	const verified = speakeasy.totp.verify({
		secret: secert,
		encoding: 'base32',
		token: code,
	  })

  	return verified;
}

export function signToken(
	userId: number,
	userToken: string
) {
	const token = CryptoJS.AES.decrypt(userToken, `${process.env.NODE_ENV}`).toString(CryptoJS.enc.Utf8);

	const jwtToken = jwt.sign({
		userId: userId,
		accessToken: token,
	}, `${process.env.NODE_ENV}`, { expiresIn: '2h' });

	return jwtToken;
}

export async function getUserData(
	login: string
)
{
	const httpService = new HttpService();
	const prisma = new PrismaService();
	let user = await prisma.user.findFirst({ where: { login: login } });
	try {
		const url_data = 'https://api.intra.42.fr/v2/me';
		const token = CryptoJS.AES.decrypt(user.token, `${process.env.NODE_ENV}`).toString(CryptoJS.enc.Utf8);
		const headersRequest = { Authorization: `Bearer ${token}` };
		const data_response = await httpService.get(url_data, { headers: headersRequest }).toPromise();
		if (user)
			await prisma.user.update({ where: { login: data_response.data['login'] }, data: {status: 1},});
		return {
			accessToken: signToken(user.id, user.token),
			userId: user.id,
			doubleAuth: user.doubleAuth,
			id: data_response.data['id'],
			email: data_response.data['email'],
			login: data_response.data['login'],
			displayname: data_response.data['displayname'],
			image: data_response.data['image_url'],
			first_name: data_response.data['first_name'],
			last_name: data_response.data['last_name'],
		};
	} catch (error) {
		error.status = 403;
		throw new HttpException(error, HttpStatus.FORBIDDEN, { cause: error });
	}
}