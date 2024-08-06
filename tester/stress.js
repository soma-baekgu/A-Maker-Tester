import http from 'k6/http';
import {sleep, check} from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export let options = {
  vus: 1,
  duration: '10s',
};

const BASE_URL = "https://dev.a-maker.co.kr"



export function setup() {
  const users = []
  for(let i = 0; i < options.vus; i++){
    const loginResponse = http.post(`${BASE_URL}/api/v1/auth/code/google?code=${randomString(8)}`)
    users.push(JSON.parse(loginResponse.body).data)
  }
  let leader = users[0]

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

  console.log(workspaceRequest)
  const workspaces = JSON.parse(workspaceRequest.body).data.workspaces
  const workspace = workspaces[workspaces.length - 1]

  users.forEach(u => {
    if (u.email === leader.email) return

    http.put(`${BASE_URL}/api/v1/workspaces/${workspace.workspaceId}/invite/activate`, null, {
      headers: {
        'Authorization': `Bearer ${u.token}`,
      },
    });
  })

  const chatRoomResponse = http.get(`${BASE_URL}/api/v1/workspaces/${workspace.workspaceId}/chat-rooms/joined`, {
    headers: {
      'Authorization': `Bearer ${leader.token}`,
    },
  })


  const chatRooms = JSON.parse(chatRoomResponse.body).data.chatRooms
  const chatRoom = chatRooms[0]

  return {workspace, chatRoom, users};
}

export default function (initdata) {
  const {workspace, chatRoom, users } = initdata
  const randomUser = users[Math.floor(Math.random() * users.length)];
  const jwtToken = randomUser.token;


  const headers = {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  };

  const endpoints = [
    {
      name: '채팅방 조회',
      method: 'GET',
      url: `${BASE_URL}/api/v1/workspaces/${workspace.workspaceId}/chat-rooms/joined`,
      params: {headers: headers}
    },
    {
      name: '채팅 생성',
      method: 'POST',
      url: `${BASE_URL}/api/v1/chat-rooms/${chatRoom.chatRoomId}/chats`,
      params: {
        headers: headers,
      },
      body: JSON.stringify({
        content: `Hello, ${randomUser.email}`,
      }),
    },
    {
      name: '채팅 조회',
      method: 'GET',
      url: `${BASE_URL}/api/v1/chat-rooms/${chatRoom.chatRoomId}/chats/recent`,
      params: {headers}
    }
  ];

  endpoints.forEach(endpoint => {
    if (endpoint.method === 'POST') {
      const response = http.post(endpoint.url, endpoint.body, endpoint.params);
      check(response, {
        "success": (res) => {
          console.log(res.status, res.url)
          if(res.status !== 201){
            console.log(res.body)
          }
          return res.status === 201;
        }
      });
    }
    else if(endpoint.method === 'GET') {
      const response = http.get(endpoint.url, endpoint.params);
      check(response, {
        "success": (res) => {
          console.log(res.status, res.url)
          if(res.status !== 200){
            console.log(res.body)
          }
          return res.status === 200;
        }
      });
    }

  });
  sleep(0.1);
}
