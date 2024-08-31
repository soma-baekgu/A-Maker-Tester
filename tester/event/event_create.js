import http from 'k6/http';
import {sleep, check} from 'k6';
import {randomString} from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const BASE_URL = "https://prod.a-maker.co.kr"

/**
 * Cache Hit Rate
 * @type {number}
 */
const HIT_RATE = 0.85

/**
 * Cache된 채팅 수
 * @type {number}
 */
const CACHE_CHAT_COUNT = 100

/**
 * 채팅방조회 성능 테스트
 * M3 mackbook pro - TPS(183)
 * @type {{duration: string, vus: number, setupTimeout: string}}
 */
export let options = {
  vus: 150,
  duration: '60s',
  setupTimeout: '1200s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
};

/**
 * Api 목록
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
        for (let i = 0; i < 25; i++) {
          const res = Api.createChat(user, chatRoomId)
          chatRooms[chatRoomId] = chatRooms[chatRoomId] || {full: [], hit: [], noHit: []}
          const chatId = res.headers.Location.split('/').pop()
          chatRooms[chatRoomId].full.push(chatId)
        }
      })
    })

    Object.keys(chatRooms).forEach(chatRoomId => {
      const fullChatIds = chatRooms[chatRoomId].full;

      const recent = fullChatIds.slice(-CACHE_CHAT_COUNT);
      const remaining = fullChatIds.slice(0, -CACHE_CHAT_COUNT);

      chatRooms[chatRoomId].full = undefined
      chatRooms[chatRoomId].hit = recent;
      chatRooms[chatRoomId].noHit = remaining;
    });


    return chatRooms
  }

  const warmUp = (users, chatRooms) => {
    users.forEach(user => {
      user.chatRooms.forEach(ch => {
        testApi.afterChat(user, ch, chatRooms[ch][0])
      })
    })
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
  warmUp(users, chatRooms)
  console.log("cache warmup completed")

  sleep(3)

  return {users, chatRooms};
}

const chooseHitOrNoHitArray = (chatRoom) => {
  const randomValue = Math.random();

  if (randomValue < HIT_RATE) return chatRoom.hit
  else return chatRoom.noHit
}

const getRandomValue = (array) => {
  return array[Math.floor(Math.random() * array.length)]
}

export default function (initdata) {
  const {users, chatRooms} = initdata
  const user = users[__VU - 1];
  const chatRoomId = user.chatRooms[__ITER % user.chatRooms.length]
  const chatRoom = chatRooms[chatRoomId]

  console.log(`${__ITER} ${user.email} request ${chatRoomId} chatroom`)

  const chatRoomChatArray = chooseHitOrNoHitArray(chatRoom)
  const randomId = getRandomValue(chatRoomChatArray)

  const start = new Date().getTime();
  const res = testApi.afterChat(user, chatRoomId, randomId)
  const duration = new Date().getTime() - start;

  check(res, {
    "success": (res) => {
      console.log(`${__ITER} ${user.email} retreieve ${chatRoomId}: ${res.status}`)
      console.log(`Request duration: ${duration}ms`);

      if (res.status === 400) {
        console.log(`${res.body}`);
      }
      if (res.status === 500) {
        console.log(`${__ITER} ${user.email} failed to retrieve ${chatRoomId}: ${res.status}`);
      }
      return res.status === 200
    }
  })

}