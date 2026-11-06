-- Outside implementing partners: a user flag (and the invitation that creates one). Access is project membership plus
-- an allow-listed set of routes; there is no new role.
ALTER TABLE "User" ADD COLUMN "external" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Invitation" ADD COLUMN "external" BOOLEAN NOT NULL DEFAULT false;
