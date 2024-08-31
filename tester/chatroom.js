import http from 'k6/http';
import {check, sleep, SharedArray} from 'k6';
import {randomString} from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export let options = {
    vus: 50,
    duration: '60s',
};

const BASE_URL = "http://127.0.0.1:8080"

export function setup() {
    const users = []
    for (let i = 0; i < options.vus; i++) {
        const loginResponse = http.post(`${BASE_URL}/api/v1/auth/code/google?code=${randomString(8)}`)
        users.push(JSON.parse(loginResponse.body).data)
    }
    console.log("user join")
    const leader = users[0]

    http.post(`${BASE_URL}/api/v1/workspaces`, JSON.stringify({
        name: "워크스페이스",
        inviteesEmails: users.map(u => u.email).filter(e => e !== leader.email),
    }), {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${leader.token}`,
        },
    })

    const workspaceRequest = http.get(`${BASE_URL}/api/v1/workspaces`, {
        headers: {
            'Authorization': `Bearer ${leader.token}`,
        },
    })

    const workspace = JSON.parse(workspaceRequest.body).data.workspaces;

    users.forEach(user => {
        const headers = {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json'
        };
        const endpoint = `${BASE_URL}/api/v1/workspaces/${workspace[workspace.length - 1].workspaceId}/invite/activate`;
        const result = http.put(endpoint, null, {headers: headers});
    });

    console.log("workspace join")

    const chatRoomResponse = http.get(`${BASE_URL}/api/v1/workspaces/${workspace[workspace.length - 1].workspaceId}/chat-rooms/joined`, {
        headers: {
            'Authorization': `Bearer ${leader.token}`,
        },
    })

    const chatRoom = JSON.parse(chatRoomResponse.body).data.chatRooms


    return {workspaces: workspace, chatRoom, users};
}

const chatIds = []

export default function (initdata) {
    const {workspace, chatRoom, users} = initdata
    const randomUser = users[Math.floor(Math.random() * users.length)];
    const jwtToken = randomUser.token;

    const chatRoomId = chatRoom[chatRoom.length - 1].chatRoomId

    // console.log(chatRoom)
    const headers = {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
    };

    const endpoints = [
        {
            name: '채팅 생성',
            method: 'POST',
            url: `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats`,
            params: {
                headers: headers,
            },
            body: JSON.stringify({
                content: `Hello, ${randomUser.email}`,
            }),
        },
        {
            name: '채팅 조회',
            method: 'RECENT-GET',
            url: `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/recent`,
            params: {headers}
        },
        {
            name: '이전 채팅 조회',
            method: 'GET',
            url: `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/previous`,
            params: {headers},
        },
        {
            name: '이후 채팅 조회',
            method: 'GET',
            url: `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/after`,
            params: {headers}
        }
    ];

    // let response
    endpoints.forEach(endpoint => {
        let response
        if (endpoint.method === 'POST') {
            response = http.post(endpoint.url, endpoint.body, endpoint.params);
            check(response, {
                "success": (res) => {
                    console.log(res.status, res.url)
                    if (res.status !== 201) {
                        console.log(res.body)
                    }
                    return res.status === 201;
                }
            });
        } else if (endpoint.method === 'RECENT-GET') {
            response = http.get(endpoint.url, endpoint.params);
            check(response, {
                "success": (res) => {
                    console.log(res.status, res.url)
                    if (res.status !== 200) {
                        console.log(res.body)
                    }
                    return res.status === 200;
                }
            });
        } else if (endpoint.method === 'GET') {
            if (chatIds.length > 0) {
                response = http.get(endpoint.url + "?cursor=" + chatIds[Math.floor(Math.random() * chatIds.length)], endpoint.params);
                check(response, {
                    "success": (res) => {
                        console.log(res.status, res.url)
                        if (res.status !== 200) {
                            console.log(res.body)
                        }
                        return res.status === 200;
                    }
                });
            }
        }

        if (response && response.status === 200) {
            if (endpoint.method === 'RECENT-GET') {
                chatIds.push(JSON.parse(response.body).data.id)
            } else if (endpoint.method === 'GET') {
                JSON.parse(response.body).data.chatList.forEach(i => chatIds.push(i.id))
            }

        }
    });

    console.log(chatIds)

    sleep(1);
}
