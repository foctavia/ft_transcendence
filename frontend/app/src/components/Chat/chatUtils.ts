import { UserAPI } from "../../store/users-contexte";

export interface Channel {
    createdAt: Date,
	id: number,
	name: string,
    creatorId: number | undefined,
    creator?: UserAPI,
    isPasswordProtected?: boolean,
    password?: string,
	messages: MessageAPI[],
	members: UserAPI[],
	admins?: UserAPI[],
	banned?: UserAPI[],
	muted?: UserAPI[],
}

export interface MessageAPI {
	createdAt: Date,
	id: number,
	senderId: number | undefined,
	content: string,
	channelId: number,
}

type User = { userId: number | undefined };
type CreateChannelDTO = {
  name: string,
  members: User[],
  isPasswordProtected?: boolean,
  password?: string,
  admins?: User[],
  banned?: User[],
  muted?: User[],
};

type UpdateChannelDTO = {
    name?: string,
    members?: User[],
    isPasswordProtected?: boolean,
    password?: string,
    admins?: User[],
    banned?: User[],
    muted?: User[],
  };

export const createNewChannel = async (chanData: CreateChannelDTO) => {

    try {

        const response = await fetch('http://localhost:3000/channels', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(chanData)
        });
        
        if (response.status === 422 || response.status === 400 || response.status === 401 || response.status === 404) {
            return response;
        }
        
        if (!response.ok) {
            throw new Error("Could not create new channel.");
        }
        const resData = await response.json();
        return resData;

    } catch (error: any) {
        console.log(error.message);
    }
}

export const deleteChat = async (chat: Channel) => {
    try {
        const response = await fetch('http://localhost:3000/channels/' + chat.id, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
    
        if (response.status === 400) {
            throw new Error("Failed to delete chat!") ;
        }

        if (!response.ok)
            throw new Error("Failed to delete chat!") ;

            
        } catch (error: any) {
            console.log(error.message);
    }
};

export const modifyChannel = async (channelId: number, chanData: UpdateChannelDTO) => {

    try {
        const response = await fetch('http://localhost:3000/channels/' + channelId, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(chanData)
        });
    
        if (response.status === 400) {
            throw new Error("Failed to modify channel!") ;
        }

        if (!response.ok)
            throw new Error("Failed to modify channel!") ;
        
    } catch (error: any) {
        console.log(error.message);
    }
};

export const removeAdmin = async (channelId: number, adminId: number) => {

    try {
        const response = await fetch('http://localhost:3000/channels/' + channelId + '/admins/' + adminId, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
        });
    
        if (response.status === 400) {
            throw new Error("Failed to remove user from channel admins!") ;
        }

        if (!response.ok)
            throw new Error("Failed to remove user from channel admins!") ;
        
    } catch (error: any) {
        console.log(error.message);
    }

};

export const removeBan = async (channelId: number, adminId: number) => {

    try {
        const response = await fetch('http://localhost:3000/channels/' + channelId + '/banned/' + adminId, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
        });
    
        if (response.status === 400) {
            throw new Error("Failed to remove user from banned users!") ;
        }

        if (!response.ok)
            throw new Error("Failed to remove user from banned users!") ;
        
    } catch (error: any) {
        console.log(error.message);
    }

};

export const removeMute = async (channelId: number, adminId: number) => {

    try {
        const response = await fetch('http://localhost:3000/channels/' + channelId + '/muted/' + adminId, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
        });
    
        if (response.status === 400) {
            throw new Error("Failed to remove user from muted users!") ;
        }

        if (!response.ok)
            throw new Error("Failed to remove user from muted users!") ;
        
    } catch (error: any) {
        console.log(error.message);
    }

};

export const kickUser = async (channelId: number, userId: number) => {

    try {
        const response = await fetch('http://localhost:3000/channels/' + channelId + '/kick/' + userId, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
        });
    
        if (response.status === 400) {
            throw new Error("Failed to kick user from channel!") ;
        }

        if (!response.ok)
            throw new Error("Failed to kick user from channel!") ;
        
    } catch (error: any) {
        console.log(error.message);
    }

};

export const banUser = async (channelId: number, userId: number) => {

    kickUser(channelId, userId);
    try {
        const response = await fetch('http://localhost:3000/channels/' + channelId + '/ban/' + userId, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
        });
    
        if (response.status === 400) {
            throw new Error("Failed to ban user!") ;
        }

        if (!response.ok)
            throw new Error("Failed to ban user!") ;
        
    } catch (error: any) {
        console.log(error.message);
    }

};