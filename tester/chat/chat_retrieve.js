import http from 'k6/http';
import {sleep, check} from 'k6';
import {randomString} from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const BASE_URL = "http://127.0.0.1:8080"

/**
 * 채팅방조회 성능 테스트
 * M3 mackbook pro - TPS(183)
 * @type {{duration: string, vus: number, setupTimeout: string}}
 */
export let options = {
  vus: 100,
  duration: '10s',
  setupTimeout: '1200s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
};

/**
 * Api 목록
 * @type {{userWorkspace: (function(*): *), userChatRooms: (function(*, *): *), workspaceJoin: (function(*, *): any), createWorkspace: (function(*, *): *), login: (function(): *)}}
 */
const Api = {
  login: () => JSON.parse(http.post(`${BASE_URL}/api/v1/auth/code/google?code=${randomString(8)}`).body).data,
  createWorkspace: (user, invitees) => http.post(`${BASE_URL}/api/v1/workspaces`, JSON.stringify({
    name: '워크스페이스',
    inviteesEmails: invitees.map(u => u.email).filter(e => e !== user.email),
  }), {
    headers: buildHeader(user)
  }),
  userWorkspace: (user) => JSON.parse(http.get(`${BASE_URL}/api/v1/workspaces`, {
    headers: buildHeader(user)
  }).body).data,
  workspaceJoin: (user, workspace) => JSON.parse(
    http.put(`${BASE_URL}/api/v1/workspaces/${workspace.workspaceId}/invite/activate`, null, {headers: buildHeader(user)}).body
  ),
  userChatRooms: (user, workspace) => JSON.parse(http.get(`${BASE_URL}/api/v1/workspaces/${workspace.workspaceId}/chat-rooms/joined`, {
    headers: buildHeader(user)
  }).body).data,
  createChat: (user, chatRoomId) => http.post(`${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats`, JSON.stringify({
    content: `Hello, ${user.email}`,
  }), {
    headers: buildHeader(user)
  }),
}

const testApi = {
  recentChat: (user, chatRoomId) => http.get(`${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/recent`, {
    headers: buildHeader(user)
  }),
  prevChat: (user, chatRoomId, cursor) => http.get(`${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/recent`, {
    headers: buildHeader(user)
  }),
  afterChat: (user, chatRoomId, cursor) => http.get(`${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/chats/after?cursor=${cursor}`, {
    headers: buildHeader(user)
  }),
  createEvent: (user, chatRoomId) => http.post(`${BASE_URL}/api/v1/chat-rooms/${chatRoomId}/events/reply`, JSON.stringify({
    eventTitle: `event ${randomUser.email}`,
    eventDetails: `event ${randomUser.email}`,
    assignees: [randomUser.email],
    deadLine: `2024-08-08T10:00:00`,
    notificationStartHour: 24,
    notificationStartMinute: 30,
    interval: 30
  }), {
    headers: buildHeader(user)
  })
}

const buildHeader = (user) => {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${user.token}`,
  }
}

function getRandomElementsWithDuplicates(arr, count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    const randomElement = arr[Math.floor(Math.random() * arr.length)];
    results.push(randomElement);
  }

  const uniqueResults = [...new Set(results)];
  return uniqueResults;
}

export function setup() {
  const userSetup = () => {
    const users = [];
    users.push(...Array(options.vus).fill().map((_, i) => {
      const res = Api.login()
      console.log(`Joined ${res.email}`)
      return res
    }));
    return users
  }

  const workspaceSetup = (users) => {
    const workspaces = [];
    users.forEach(user => {
      let joiner = getRandomElementsWithDuplicates(users, 9);
      Api.createWorkspace(user, joiner)

      const userWorkspaces = Api.userWorkspace(user).workspaces
      console.log(`Workspace created: ${userWorkspaces[0].workspaceId}`)
      joiner.forEach(user => {
        user.willingToWorkspace = user.willingToWorkspace || []
        user.willingToWorkspace.push(userWorkspaces[0])
      })
      workspaces.push(userWorkspaces[0]);
    });
    return workspaces;
  }

  const workspaceJoinSetup = (users) => {
    users.forEach(user => {
      user.willingToWorkspace.forEach(workspace => {
        Api.workspaceJoin(user, workspace)
      })

      const userWorkspaces = Api.userWorkspace(user).workspaces
      console.log(`user ${user.email} joined ${userWorkspaces.map(w => w.workspaceId)}`)
      user.workspaces = userWorkspaces
    })
    return users
  }

  const chatRoomSetup = (users) => {
    users.forEach(user => {
      user.workspaces.forEach(workspace => {
        let res = Api.userChatRooms(user, workspace);
        const chatrooms = res.chatRooms
        user.chatRooms = user.chatRooms || []
        chatrooms.forEach(ch => user.chatRooms.push(ch.chatRoomId))
      })
      console.log(`chatroom ${user.email} ${user.chatRooms}`)
    })
  }

  const chatSetup = (users) => {
    const chatRooms = {}
    users.forEach(user => {
      user.chatRooms.forEach(chatRoomId => {
        for (let i = 0; i < 10; i++) {
          const res = Api.createChat(user, chatRoomId)
          chatRooms[chatRoomId] = chatRooms[chatRoomId] || []
          chatRooms[chatRoomId].push(res.headers.Location.split('/').pop())
        }
      })
    })
    return chatRooms
  }

  const users = userSetup()
  console.log("User join completed");
  const workspaces = workspaceSetup(users)
  console.log("Workspace create completed");
  workspaceJoinSetup(users, workspaces)
  console.log("Workspace creation and join completed");
  chatRoomSetup(users)
  console.log("ChatRoom retrieve completed")
  const chatRooms = chatSetup(users)
  console.log("Chat set up completed")

  return {users, chatRooms};
}

export default function (initdata) {
  const {users, chatRooms} = initdata
  const user = users[__VU - 1];
  const chatRoomId = user.chatRooms[__ITER % user.chatRooms.length]
  const chatRoom = chatRooms[chatRoomId]

  console.log(`${__ITER} ${user.email} request ${chatRoomId} chatroom`)
  const randomId = chatRoom[Math.floor(Math.random() * chatRoom.length)]

  const start = new Date().getTime();
  const res = testApi.afterChat(user, chatRoomId, randomId)
  const duration = new Date().getTime() - start;

  check(res, {
    "success": (res) => {
      console.log(`${__ITER} ${user.email} retreieve ${chatRoomId}: ${res.status}`)
      console.log(`Request duration: ${duration}ms`);


      if (res.status === 500) {
        console.log(`${__ITER} ${user.email} failed to retrieve ${chatRoomId}: ${res.status}`);
      }
      return res.status === 200
    }
  })

}

// TPS 305
/** 캐시 X TPS 121
     ✓ success

     checks.........................: 100.00% ✓ 8476       ✗ 0
     data_received..................: 62 MB   873 kB/s
     data_sent......................: 9.0 MB  127 kB/s
     http_req_blocked...............: avg=18.53µs  min=0s     med=3µs      max=30.87ms  p(90)=5µs      p(95)=8µs
     http_req_connecting............: avg=13.98µs  min=0s     med=0s       max=27.76ms  p(90)=0s       p(95)=0s
   ✓ http_req_duration..............: avg=50.94ms  min=1.5ms  med=6.24ms   max=513.38ms p(90)=128.64ms p(95)=172.47ms
       { expected_response:true }...: avg=50.97ms  min=1.5ms  med=6.25ms   max=513.38ms p(90)=128.67ms p(95)=172.48ms
     http_req_failed................: 0.05%   ✓ 11         ✗ 20416
     http_req_receiving.............: avg=150.76µs min=7µs    med=92µs     max=15.26ms  p(90)=318µs    p(95)=402µs
     http_req_sending...............: avg=28.95µs  min=2µs    med=18µs     max=64.16ms  p(90)=36µs     p(95)=46µs
     http_req_tls_handshaking.......: avg=0s       min=0s     med=0s       max=0s       p(90)=0s       p(95)=0s
     http_req_waiting...............: avg=50.76ms  min=1.37ms med=6.02ms   max=513ms    p(90)=128.36ms p(95)=172.13ms
     http_reqs......................: 20427   287.028201/s
     iteration_duration.............: avg=124.93ms min=3.02ms med=103.41ms max=1m1s     p(90)=183.98ms p(95)=233.98ms
     iterations.....................: 8476    119.099772/s
     vus............................: 100     min=0        max=100
     vus_max........................: 100     min=100      max=100


running (1m11.2s), 000/100 VUs, 8476 complete and 0 interrupted iterations
default ✓ [======================================] 100 VUs  10s


 */
/** 캐시 TPS 491.89
      ✓ success

     checks.........................: 100.00% ✓ 16452      ✗ 0
     data_received..................: 113 MB  2.0 MB/s
     data_sent......................: 12 MB   215 kB/s
     http_req_blocked...............: avg=19.52µs min=0s     med=1µs     max=67.2ms   p(90)=4µs     p(95)=6µs
     http_req_connecting............: avg=16.26µs min=0s     med=0s      max=67.14ms  p(90)=0s      p(95)=0s
   ✓ http_req_duration..............: avg=36.33ms min=1.05ms med=48.44ms max=422.55ms p(90)=77.98ms p(95)=94.55ms
       { expected_response:true }...: avg=36.34ms min=1.05ms med=48.45ms max=422.55ms p(90)=78.01ms p(95)=94.56ms
     http_req_failed................: 0.05%   ✓ 15         ✗ 28169
     http_req_receiving.............: avg=72.56µs min=6µs    med=56µs    max=5.84ms   p(90)=118µs   p(95)=165µs
     http_req_sending...............: avg=18.02µs min=1µs    med=6µs     max=67.95ms  p(90)=29µs    p(95)=37µs
     http_req_tls_handshaking.......: avg=0s      min=0s     med=0s      max=0s       p(90)=0s      p(95)=0s
     http_req_waiting...............: avg=36.23ms min=941µs  med=48.38ms max=422.5ms  p(90)=77.87ms p(95)=94.45ms
     http_reqs......................: 28184   491.89165/s
     iteration_duration.............: avg=63.41ms min=1.43ms med=53.52ms max=47.24s   p(90)=93.35ms p(95)=107.61ms
     iterations.....................: 16452   287.134595/s
     vus............................: 100     min=0        max=100
     vus_max........................: 100     min=100      max=100

 */