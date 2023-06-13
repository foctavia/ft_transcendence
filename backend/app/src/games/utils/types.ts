export type ServeInfo = {
	initialDelta: number;
	level: number;
}

export type CollisionInfo = {
	y: number;
	r: number;
	playerY: number;
	paddleHeight: number;
	speed: number;
}

export type GameOverInfo = {
	playerId: number;
	playerScore: number;
	opponentScore: number;
}