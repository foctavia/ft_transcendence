import { useState, useEffect } from 'react';
import '../../sass/main.scss'

type LiveBoardProps = {
	isReady: boolean;
	username: string;
	opponentName: string;
	start(status: true | false): void;
}

interface State {
	time: number;
	seconds: number;
}

export default function LiveBoard({ isReady, username, opponentName, start }: LiveBoardProps) {
	const [state, setState] = useState<State>({
		time: 3,
		seconds: 3,
	});

	useEffect(() => {
		if (isReady) {
			setTimeout(() => {
				if (state.time === 0) {
					return ;
				}
	
				setState({
					time: state.time - 1,
					seconds: state.time - Math.floor((state.time) / 60) * 60 - 1,
				});
			}, 1000);
		}
		if (state.seconds === 0) {
			start(true);
		}
	}, [state.time, isReady]);

	return (
		<div className="liveboard">
			<div className="liveboard-contents">
				{!isReady && (
					<>
						<h2>Welcome to live battle!!</h2>
						<p>Please wait for your opponent ...</p>
					</>
				)}
				{isReady && (
					<>
						<h1>{username} VS {opponentName}</h1>
						<h2>{state.seconds}</h2>
					</>
				)}
			</div>
		</div>
	);
}