import http from 'k6/http';
import {sleep, check} from 'k6';
import {randomString} from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export let options = {
  vus: 100,
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
    const result = http.post(`${BASE_URL}/api/v1/workspaces`, JSON.stringify({
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
