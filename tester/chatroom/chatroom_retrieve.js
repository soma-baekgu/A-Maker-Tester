import http from 'k6/http';
import {sleep, check} from 'k6';
import {randomString} from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const BASE_URL = "http://127.0.0.1:8080"

/**
 * 채팅 조회 성능 테스트
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
  userChatRooms: (user, workspace) => http.get(`${BASE_URL}/api/v1/workspaces/${workspace.workspaceId}/chat-rooms/joined`, {
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

  const workspaceJoinSetup = (users, workspaces) => {
    users.forEach(user => {
      user.willingToWorkspace.forEach(workspace => {
        Api.workspaceJoin(user, workspace)
      })

      const userWorkspaces = Api.userWorkspace(user).workspaces
      console.log(`user ${user.email} joined ${userWorkspaces.map(w => w.workspaceId)}`)
      user.workspace = userWorkspaces
    })
    return users
  }

  const users = userSetup()
  console.log("User join completed");
  const workspaces = workspaceSetup(users)
  console.log("Workspace create completed");
  workspaceJoinSetup(users, workspaces)
  console.log("Workspace creation and join completed");

  return {users};
}

export default function (initdata) {
  const {users} = initdata
  const user = users[__VU - 1];
  const workspace = user.workspace[__ITER % user.workspace.length]

  console.log(`${__ITER} ${user.email} request ${workspace.workspaceId} chatroom`)
  const start = new Date().getTime();
  const res = Api.userChatRooms(user, workspace)
  const duration = new Date().getTime() - start; // 요청에 걸린 시간 계산

  check(res, {
    "success": (res) => {
      console.log(`${__ITER} ${user.email} retreieve ${workspace.workspaceId}: ${res.status}`)
      console.log(`Request duration: ${duration}ms`); // 요청에 걸린 시간 출력


      if (res.status === 500) {
        console.log(`${__ITER} ${user.email} failed to retrieve ${workspace.workspaceId}: ${res.status}`);
      }
      return res.status === 200
    }
  })
}
