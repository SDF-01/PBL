import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";

initializeApp();

setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
});

export { approveClub } from "./commands/approveClub";
export { onClubCreated } from "./triggers/onClubCreated";
export { rejectClub } from "./commands/rejectClub";
export { assignRole } from "./commands/assignRole";
export { deactivateUserRole } from "./commands/deactivateUserRole";
export { setUserGlobalRole } from "./commands/setUserGlobalRole";
export { syncMyClaims } from "./commands/syncMyClaims";
export { submitMatchScore } from "./commands/submitMatchScore";
export { verifyMatchScore } from "./commands/verifyMatchScore";
export { disputeMatch } from "./commands/disputeMatch";
export { adminAssignMatchResult } from "./commands/adminAssignMatchResult";
export { persistGeneratedSession } from "./commands/persistGeneratedSession";
export { finalizeSession } from "./commands/finalizeSession";
