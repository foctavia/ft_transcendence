import React from 'react';
import Canvas from '../Canvas';

type PlayerProps = {
	width: number;
	height: number;
	paddleHeight: number;
	paddleWidth: number;
	paddleSpeed: number;
	upArrow: number;
	downArrow: number;
}

type PlayerState = {
	player: {
		x: number;
		y: number;
		score: number;
	}
}

const InitialState = () => {
	return {
		player: {
			x: 10,
			y: 100,
			score: 0,
		}
	}
}

class Player extends React.Component<PlayerProps, PlayerState> {
	constructor(props: PlayerProps) {
		super(props);
		this.state = InitialState();
	}

	render() {
		const draw = (ctx: CanvasRenderingContext2D, frameCount: number) => {
			ctx.clearRect(0, 0, this.props.width, this.props.height);
			ctx.fillRect(this.state.player.x, this.state.player.y, this.props.paddleWidth, this.props.paddleHeight);
			ctx.save();
			ctx.fillStyle = '#000000';
		}

		return <Canvas
					draw={draw}
					width={this.props.width}
					height={this.props.height}
				/>
	}
}

export default Player;