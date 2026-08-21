export function getLiveSessionBrand(isTeachGame: boolean): string {
  return isTeachGame ? "Teach Live Game" : "SonoQuiz";
}

export function getHostSessionReturnPath(isTeachGame: boolean): string {
  return isTeachGame ? "/teach/games" : "/admin/sonoquiz";
}

export function getJoinRoute(joinCode: string): string {
  return `/quiz/${joinCode.toUpperCase()}`;
}
