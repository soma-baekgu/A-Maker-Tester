import http from 'k6/http';
import {sleep, check} from 'k6';
import {SharedArray} from 'k6/data';

export let options = {
  vus: 100,
  duration: '10s',
};

const BASE_URL = __ENV.BASE_URL
console.log(BASE_URL)

// JSON 파일을 init 단계에서 읽어오는 함수
const usersArray = new SharedArray('usersArray', function () {
  const users = JSON.parse(open('../test_data/user_jwts.json'));
  return Object.entries(users).map(([email, jwt]) => ({email, jwt}));
});

const leader = usersArray[0]

export function setup() {
  const initResponse = http.post(`${BASE_URL}/workspaces`, JSON.stringify({
    name: "워크스페이스",
    inviteesEmails: usersArray.map(u => u.email).filter(e => e !== leader.email),
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${leader.jwt}`,
    },
  })

  const workspaceRequest = http.get(`${BASE_URL}/workspaces`, {
    headers: {
      'Authorization': `Bearer ${leader.jwt}`,
    },
  })
  const workspaces = JSON.parse(workspaceRequest.body).data.workspaces
  const workspace = workspaces[workspaces.length - 1]

  usersArray.forEach(u => {
    if (u.email === leader.email) return

    http.put(`${BASE_URL}/workspaces/${workspace.workspaceId}/invite/activate`, null, {
      headers: {
        'Authorization': `Bearer ${u.jwt}`,
      },
    });
  })

  const chatRoomResponse = http.get(`${BASE_URL}/workspaces/${workspace.workspaceId}/chat-rooms/joined`, {
    headers: {
      'Authorization': `Bearer ${leader.jwt}`,
    },
  })


  const chatRooms = JSON.parse(chatRoomResponse.body).data.chatRooms
  const chatRoom = chatRooms[0]

  // 응답 데이터를 가공하여 필요한 초기 데이터를 반환합니다.
  return {workspace, chatRoom};
}

export default function (initdata) {
  const {workspace, chatRoom } = initdata
  const randomUser = usersArray[Math.floor(Math.random() * usersArray.length)];
  const jwtToken = randomUser.jwt;


  const headers = {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  };

  const endpoints = [
    {
      name: '채팅방 조회',
      method: 'GET',
      url: `${BASE_URL}/workspaces/${workspace.workspaceId}/chat-rooms/joined`,
      params: {headers: headers}
    },
    {
      name: '채팅 생성',
      method: 'POST',
      url: `${BASE_URL}/chat-rooms/${workspace.workspaceId}/chats`,
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
      url: `${BASE_URL}/chat-rooms/${chatRoom.chatRoomId}/chats/recent`,
      params: {headers}
    }
  ];

  endpoints.forEach(endpoint => {
    if (endpoint.method === 'POST') {
      const response = http.post(endpoint.url, endpoint.body, endpoint.params);
      check(response, {
        "success": (res) => {
          console.log(res.status, res.url)
          return res.status === 201;
        }
      });
    }
    else if(endpoint.method === 'GET') {
      const response = http.get(endpoint.url, endpoint.params);
      check(response, {
        "success": (res) => {
          console.log(res.status, res.url)
          return res.status === 200;
        }
      });
    }

    sleep(0.01);
  });
}
