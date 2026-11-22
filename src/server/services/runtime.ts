import {
  createLocalServer,
  startLocalServer,
  stopLocalServer,
  killLocalServer,
  restartLocalServer,
  deleteLocalServer,
  getLocalServerStatus,
  getLocalServerStats,
  getLocalServerLogs,
  attachLocalServerSocket,
  sendLocalServerCommand
} from "./local.js";

export const createServerRuntime = async (serverData: any, _nodeId?: string) => {
  return await createLocalServer(serverData);
};

export const startServerRuntime = async (server: any) => {
  return await startLocalServer(server.id, server);
};

export const stopServerRuntime = async (server: any) => {
  return await stopLocalServer(server.id);
};

export const restartServerRuntime = async (server: any) => {
  return await restartLocalServer(server.id, server);
};

export const killServerRuntime = async (server: any) => {
  return await killLocalServer(server.id);
};

export const deleteServerRuntime = async (server: any) => {
  return await deleteLocalServer(server.id);
};

export const getServerRuntimeStatus = async (server: any) => {
  return await getLocalServerStatus(server.id);
};

export const getServerRuntimeStats = async (server: any) => {
  return await getLocalServerStats(server.id);
};

export const getServerRuntimeLogs = async (server: any) => {
  return await getLocalServerLogs(server.id);
};

export const attachServerRuntimeSocket = async (server: any, serverId: string) => {
  return attachLocalServerSocket(server.id, serverId);
};

export const sendServerRuntimeCommand = async (server: any, command: string) => {
  return sendLocalServerCommand(server.id, command);
};
