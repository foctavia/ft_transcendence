import { useContext, useEffect, useState } from "react";
import { Channel, MessageAPI } from "../../pages/Chat";
import classes from '../../sass/components/Chat/ChatInfo.module.scss';
import ProfilIcon from "../Profile/ProfilIcon";
import { UserAPI, UserContext } from "../../store/users-contexte";

// const Searchbar: React.FC<{onSaveSearch: (input: string) => void}> = ( props ) => {

const ChatInfo: React.FC<{chats: Channel[], chat: Channel, isSelected: boolean, onSaveConversation: (channel: Channel) => void}> 
	= ( props ) => {

	const [sender, setSender] = useState<UserAPI | null>(null);
	const [lastMessage, setLastMessage] = useState<MessageAPI | null>(null);
	const [ conversation, setConversation ] = useState<number>(0);
	const userCtx = useContext(UserContext);

	const conversationHandler = () => {
		setConversation(props.chat.id)
		props.onSaveConversation(props.chat);
	}

	const getSender = () => {
		if (props.chat.name === "private")
		{
			props.chat.members.forEach((member) => {
				if (member.id != userCtx.user?.id)
					setSender(member);
			})
		}
	}

	const getLastMessage = () => {

		const messages = props.chat.messages;
		let latestMessage = null;
		if (messages.length > 0) {
			latestMessage = messages.reduce((latest, current) => {
				return new Date(latest.createdAt) > new Date(current.createdAt) ? latest : current;
			}, messages[0]);

		}
		setLastMessage(latestMessage);
	}

	useEffect(() => {
		getSender();
		getLastMessage();
	}, [conversation, props.chats]);
	
	return (
		<div className={`${classes.container} ${props.isSelected ? classes.selected : ''}`}>
			<div className={classes.picture}>
			<ProfilIcon user={sender} displayCo={false} size={["4rem", "4rem"]} />
			</div>
			<div className={classes.info} onClick={conversationHandler}>
				<p className={classes.name}>
					{ sender?.name}
				</p>
				{
					props.chat.messages.length > 0 ? 
					<p className={classes.lastMessage}>
						{lastMessage?.content}
					</p> 
					:
					<p className={classes.lastMessage} style={{fontStyle: 'italic'}}>
						draft...
					</p>
				}
			</div>
		</div>
	)
}

export default ChatInfo;