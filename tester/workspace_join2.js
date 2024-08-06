import http from 'k6/http';
import {sleep, check} from 'k6';
import {randomString} from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export let options = {
  vus: 2,
  duration: '1s',
};

const BASE_URL = "http://127.0.0.1:8080"


export function setup() {
  const users = []
  for (let i = 0; i < options.vus; i++) {
    const loginResponse = http.post(`${BASE_URL}/api/v1/auth/code/google?code=${randomString(8)}`)
    users.push(JSON.parse(loginResponse.body).data)
  }
  console.log("user join")

  const workspaces = []
  users.forEach(user => {
    http.post(`${BASE_URL}/api/v1/workspaces`, JSON.stringify({
      name: "워크스페이스",
      inviteesEmails: users.map(u => u.email).filter(e => e !== user.email),
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`,
      },
    })

    const workspaceRequest = http.get(`${BASE_URL}/api/v1/workspaces`, {
      headers: {
        'Authorization': `Bearer ${user.token}`,
      },
    })
    const userWorkspaces = JSON.parse(workspaceRequest.body).data.workspaces;
    workspaces.push(userWorkspaces[userWorkspaces.length - 1])
  })

  return {workspaces, users};
}

export default function (initdata) {
  const {workspaces, users} = initdata
  const user = users[__VU - 1];
  const myWorkspace = workspaces[__VU - 1];
  const jwtToken = user.token;

  // console.log("waiting...")


  const headers = {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  };


  const endpoint =
    {
      name: '워크스페이스 조인',
      method: 'PUT',
      url: (workspace) => `${BASE_URL}/api/v1/workspaces/${workspace.workspaceId}/invite/activate`,
      params: {headers: headers}
    }

  const retrieveChatRoom = {
    name: '채팅방 조회',
    method: 'GET',
    url: (workspace) => `${BASE_URL}/api/v1/workspaces/${workspace.workspaceId}/chat-rooms/joined`,
    params: {headers: headers}
  }

  const createChatRoom = {
    name: '채팅 생성',
    method: 'POST',
    url: (chatRoom) => `${BASE_URL}/api/v1/chat-rooms/${chatRoom.chatRoomId}/chats`,
    params: {
      headers: headers,
    },
    body: JSON.stringify({
      content: `Hello`,
    }),
  }

  const retrieveChat = {
    name: '채팅 조회',
    method: 'GET',
    url: (chatRoom) => `${BASE_URL}/api/v1/chat-rooms/${chatRoom.chatRoomId}/chats/recent`,
    params: {headers}
  }

  const res = http.put(endpoint.url(workspaces[Math.floor(Math.random() * workspaces.length)]), null, endpoint.params)
  check(res, {
    "success": (res) => {
      return res.status === 200 || res.status === 400;
    }
  });

  const retrieveChatRoomRes = http.get(retrieveChat.url(myWorkspace), endpoint.params)
  check(retrieveChatRoomRes, {
    "success": (res) => {
      return res.status === 200
    }
  });

  console.log(JSON.parse(retrieveChatRoomRes.body).data)


  workspaces.forEach(w => {
    const res = http.put(endpoint.url(w), null, endpoint.params)
    check(res, {
      "success": (res) => {
        return res.status === 200 || res.status === 400;
      }
    });
  })
  sleep(1);
}
