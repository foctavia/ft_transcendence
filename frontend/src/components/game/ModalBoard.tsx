import { useState } from 'react';
import '../../sass/main.scss'

type ModalProps = {
	buttonText: string;
	text: string;
	onStartPage(): void;
	onTool(mode: "keyboard" | "mouse"): void;
	onDifficulty(level: "beginner" | "medium" | "hard"): void;
	onPlayerMode(mode: "single" | "double"): void;
}

export default function ModalBoard({ onDifficulty, onTool, onPlayerMode, onStartPage, buttonText, text }: ModalProps) {
	const [isStarting, setIsStarting] = useState(buttonText === "Start playing" ? true : false);
	const [page, setPage] = useState(0);
	const [isDouble, setIsDouble] = useState(false);

	const onNextPage = () => {
		setPage(p => p += 1);
	}

	return (
		<div className="modal">
			<div className="modal-contents" onClick={onNextPage}>
				{(isStarting && page === 0) && (
					<>
						<h2>Ready to have fun?</h2>
						<p>(click anywhere ...)</p>
					</>
				)}
				{(isStarting && page === 1) && (
					<>
						<button onClick={() => {onDifficulty("beginner")}}>Beginner level</button>
						<button onClick={() => {onDifficulty("medium")}}>Medium level</button>
						<button onClick={() => {onDifficulty("hard")}}>Hard level</button>
					</>
				)}
				{(isStarting && page === 2) && (
					<>
						<button onClick={() => {onTool("keyboard")}}>Play with keyboard</button>
						<button onClick={() => {onTool("mouse")}}>Play with mouse</button>
					</>
				)}
				{(isStarting && page === 3) && (
					<>
						<button onClick={() => {onPlayerMode("single")}}>1 player</button>
						<button onClick={() => {onPlayerMode("double"); setIsDouble(true);}}>2 players</button>
					</>
				)}
				{(isStarting && page === 4 && !isDouble) && (
					<>
						<h2>Are you ready?</h2>
						<button onClick={onStartPage}>{buttonText}</button>
					</>
				)}
				{!isStarting && (
					<>
						<h2>{text}</h2>
						<button onClick={() => {setIsStarting(true); setPage(0); onPlayerMode("single");}}>{buttonText}</button>
					</>
				)}
			</div>
		</div>
	);
}