import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export let options = {
    vus: 250,
    duration: '60s',
    setupTimeout: '1200s',
};

const BASE_URL = "http://127.0.0.1:8080";
const MESSAGES_PER_CHATROOM = 10000;
const BATCH_SIZE = 1000;

export function setup() {
    const users = [];
    for (let i = 0; i < options.vus; i++) {
        const loginResponse = http.post(`${BASE_URL}/api/v1/auth/code/google?code=${randomString(8)}`);
        users.push(JSON.parse(loginResponse.body).data);
    }
    console.log("Users joined");

    const workspaces = [];
    const userWorkspaceMap = {};

    for (let i = 0; i < options.vus; i++) {
        const user = users[i];
        const startIndex = i * 50;
        const endIndex = (i + 1) * 50;
        const workspaceUsers = users.slice(startIndex, endIndex);
        const inviteesEmails = workspaceUsers
          .map(u => u.email)
          .filter(e => e !== user.email);

        const result = http.post(`${BASE_URL}/api/v1/workspaces`, JSON.stringify({
            name: `워크스페이스_${i}`,
            inviteesEmails: inviteesEmails,
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`,
            },
        });

        const workspaceRequest = http.get(`${BASE_URL}/api/v1/workspaces`, {
            headers: {
                'Authorization': `Bearer ${user.token}`,
            },
        });

        const userWorkspaces = JSON.parse(workspaceRequest.body).data.workspaces;
        const newWorkspace = userWorkspaces[userWorkspaces.length - 1];
        workspaces.push(newWorkspace);

        workspaceUsers.forEach(u => {
            if (!userWorkspaceMap[u.email]) {
                userWorkspaceMap[u.email] = [];
            }
            userWorkspaceMap[u.email].push(newWorkspace.workspaceId);
        });
    }

    for (const email in userWorkspaceMap) {
        userWorkspaceMap[email].forEach(workspaceId => {
            const user = users.find(u => u.email === email);
            const headers = {
                'Authorization': `Bearer ${user.token}`,
                'Content-Type': 'application/json',
            };
            const endpoint = `${BASE_URL}/api/v1/workspaces/${workspaceId}/invite/activate`;
            http.put(endpoint, null, { headers: headers });
        });
    }

    console.log("Workspaces joined");

    const chatRoomIds = [];
    const userChatRooms = {};
    for (let i = 0; i < workspaces.length; i++) {
        const workspace = workspaces[i];
        const result = http.get(`${BASE_URL}/api/v1/workspaces/${workspace.workspaceId}/chat-rooms/joined`, {
            headers: {
                'Authorization': `Bearer ${users[i * 50].token}`,
            },
        });

        const chatRooms = JSON.parse(result.body).data.chatRooms;
        chatRooms.forEach(chatRoom => {
            chatRoomIds.push(chatRoom.chatRoomId);
        });

        users.slice(i * 50, (i + 1) * 50).forEach(user => {
            userChatRooms[user.email] = chatRooms.map(room => room.chatRoomId);
        });
    }

    console.log("chatRooms joined")

        // Pre-populate each chat room with 100,000 messages
    // chatRoomIds.forEach(chatRoomId => {
    //     for (let i = 0; i < MESSAGES_PER_CHATROOM / BATCH_SIZE; i++) {
    //         const randomUser = users[Math.floor(Math.random() * users.length)];
    //         const jwtToken = randomUser.token;
    //         const headers = {
    //             'Authorization': `Bearer ${jwtToken}`,
    //             'Content-Type': 'application/json',
    //         };
    //
    //         const messages = [];
    //         for (let j = 0; j < BATCH_SIZE; j++) {
    //             messages.push({
    //                 content: `Prepopulated message ${i * BATCH_SIZE + j}`,
    //             });
    //         }
    //
    //         http.batch(messages.map(msg => ({
    //             method: 'POST',
    //             url: `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats`,
    //             body: JSON.stringify(msg),
    //             params: { headers },
    //         })));
    //     }
    // });

    return { chatRoomIds, users, userChatRooms };
}

const chatRoom = [];

for (let i = 0; i < options.vus; i++) {
    chatRoom[i] = [];
}

export default function (initdata) {
    const { chatRoomIds, users, userChatRooms } = initdata;
    const randomUser = users[Math.floor(Math.random() * users.length)];
    const jwtToken = randomUser.token;
    const chatRoomId = userChatRooms[randomUser.email][0]; // 사용자가 속한 첫 번째 채팅방 선택

    const headers = {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
    };

    const endpoints = [
        {
            name: '채팅 생성',
            method: 'POST',
            url: (chatRoomId) => `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats`,
            params: {
                headers: headers,
            },
            body: JSON.stringify({
                content: `Hello, ${randomUser.email}`,
            }),
        },
        {
            name: '이벤트 생성',
            method: 'POST',
            url: (chatRoomId) => `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/events/reply`,
            params: {
                headers: headers,
            },
            body: JSON.stringify({
                eventTitle: `event ${randomUser.email}`,
                eventDetails: `event ${randomUser.email}`,
                assignees: [randomUser.email],
                deadLine: `2024-08-08T10:00:00`,
                notificationStartHour: 24,
                notificationStartMinute: 30,
                interval: 30
            }),
        },
        {
            name: '채팅 조회',
            method: 'RECENT-GET',
            url: (chatRoomId) => `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/recent`,
            params: { headers },
        },
        {
            name: '이전 채팅 조회',
            method: 'GET',
            url: (chatRoomId) => `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/previous`,
            params: { headers },
        },
        {
            name: '이후 채팅 조회',
            method: 'GET',
            url: (chatRoomId) => `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/after`,
            params: { headers },
        },
        {
            name: '채팅 조회',
            method: 'RECENT-GET',
            url: (chatRoomId) => `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/recent`,
            params: { headers },
        },
        {
            name: '이전 채팅 조회',
            method: 'GET',
            url: (chatRoomId) => `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/previous`,
            params: { headers },
        },
        {
            name: '이후 채팅 조회',
            method: 'GET',
            url: (chatRoomId) => `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/after`,
            params: { headers },
        },
        {
            name: '채팅 조회',
            method: 'RECENT-GET',
            url: (chatRoomId) => `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/recent`,
            params: { headers },
        },
        {
            name: '이전 채팅 조회',
            method: 'GET',
            url: (chatRoomId) => `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/previous`,
            params: { headers },
        },
        {
            name: '이후 채팅 조회',
            method: 'GET',
            url: (chatRoomId) => `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/after`,
            params: { headers },
        },
    ];

    endpoints.forEach(endpoint => {
        let response;
        if (endpoint.method === 'POST') {
            response = http.post(endpoint.url(chatRoomId), endpoint.body, endpoint.params);
            check(response, {
                "success": (res) => res.status === 201,
            });
        } else if (endpoint.method === 'RECENT-GET') {
            response = http.get(endpoint.url(chatRoomId), endpoint.params);
            check(response, {
                "success": (res) => res.status === 200,
            });
        } else if (endpoint.method === 'GET') {
            const temp = chatRoom[chatRoomId % options.vus];
            if (temp.length > 0) {
                response = http.get(endpoint.url(chatRoomId) + "?cursor=" + getRandomRecentItem(temp, 100), endpoint.params);
                check(response, {
                    "success": (res) => res.status === 200,
                });
            }
        }

        if (response && response.status === 200) {
            if (endpoint.method === 'RECENT-GET') {
                chatRoom[chatRoomId % options.vus].push(JSON.parse(response.body).data.id);
            } else if (endpoint.method === 'GET') {
                JSON.parse(response.body).data.chatList.forEach(i => {
                    chatRoom[chatRoomId % options.vus].push(i.id);
                });
            }
        }
    });

    sleep(1);
}

// 최근에 push된 항목들을 우선적으로 조회하는 함수
function getRandomRecentItem(temp, recentCount = 5) {
    // temp 배열에서 최근에 push된 recentCount개의 항목들을 우선적으로 선택
    if (temp.length < recentCount) {
        return temp[Math.floor(Math.random() * temp.length)];
    }

    const recentItems = temp.slice(-recentCount);

    // recentItems 배열에서 랜덤하게 선택
    return recentItems[Math.floor(Math.random() * recentItems.length)];
}

