import http from 'k6/http';
import {check, sleep} from 'k6';
import {randomString} from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export let options = {
    vus: 50,
    duration: '60s',
    setupTimeout: '1200s'
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

    const workspaces = [];
    users.forEach(user => {
        const result = http.post(`${BASE_URL}/api/v1/workspaces`, JSON.stringify({
            name: "워크스페이스",
            inviteesEmails: users.map(u => u.email).filter(e => e !== user.email),
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
        workspaces.push(userWorkspaces[userWorkspaces.length - 1]);
    });

    workspaces.forEach(workspace => {
        users.forEach(user => {
            const headers = {
                'Authorization': `Bearer ${user.token}`,
                'Content-Type': 'application/json'
            };
            const endpoint = `${BASE_URL}/api/v1/workspaces/${workspace.workspaceId}/invite/activate`;
            const res = http.put(endpoint, null, {headers: headers});
        });
    });

    console.log("workspace join")

    const chatRoomIds = []
    const result = http.get(`${BASE_URL}/api/v1/workspaces/${workspaces[0].workspaceId}/chat-rooms/joined`, {
        headers: {
            'Authorization': `Bearer ${leader.token}`,
        },
    })

    const cr = JSON.parse(result.body).data.chatRooms
    const first = cr[cr.length - 1].chatRoomId

    for (let i = first; i < first + options.vus; i++) {
        chatRoomIds.push(i)
    }

    return {chatRoomIds, users};
}

const chatRoom = [];

for (let i = 0; i < options.vus; i++) {
    chatRoom[i] = [];
}

export default function (initdata) {
    const {chatRoomIds, users} = initdata
    const randomUser = users[Math.floor(Math.random() * users.length)];
    const jwtToken = randomUser.token;


    const headers = {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
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
            params: {headers}
        },
        {
            name: '이전 채팅 조회',
            method: 'GET',
            url: (chatRoomId) => `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/previous`,
            params: {headers},
        },
        {
            name: '이후 채팅 조회',
            method: 'GET',
            url: (chatRoomId) => `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/after`,
            params: {headers}
        },
        {
            name: '채팅 조회',
            method: 'RECENT-GET',
            url: (chatRoomId) => `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/recent`,
            params: {headers}
        },
        {
            name: '이전 채팅 조회',
            method: 'GET',
            url: (chatRoomId) => `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/previous`,
            params: {headers},
        },
        {
            name: '이후 채팅 조회',
            method: 'GET',
            url: (chatRoomId) => `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/after`,
            params: {headers}
        },
        {
            name: '채팅 조회',
            method: 'RECENT-GET',
            url: (chatRoomId) => `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/recent`,
            params: {headers}
        },
        {
            name: '이전 채팅 조회',
            method: 'GET',
            url: (chatRoomId) => `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/previous`,
            params: {headers},
        },
        {
            name: '이후 채팅 조회',
            method: 'GET',
            url: (chatRoomId) => `${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/after`,
            params: {headers}
        }
    ];

    // let response
    endpoints.forEach(endpoint => {
        const chatRoomId = chatRoomIds[Math.floor(Math.random() * users.length)]
        let response
        if (endpoint.method === 'POST') {
            response = http.post(endpoint.url(chatRoomId), endpoint.body, endpoint.params);
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
            response = http.get(endpoint.url(chatRoomId), endpoint.params);
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
            const temp = chatRoom[chatRoomId % options.vus]
            if (temp.length > 0) {
                response = http.get(endpoint.url(chatRoomId) + "?cursor=" + getRandomRecentItem(temp, 100), endpoint.params);
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
                console.log(JSON.parse(response.body).data.id)
                chatRoom[chatRoomId % options.vus].push(JSON.parse(response.body).data.id)
            } else if (endpoint.method === 'GET') {
                JSON.parse(response.body).data.chatList.forEach(i => {
                    if (i.id == null) {
                        console.log("===============")
                        console.log(JSON.parse(response.body).data)
                        console.log("===============")
                    }
                    chatRoom[chatRoomId % options.vus].push(i.id)
                })
            }

        }
    })
    sleep(5)
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

