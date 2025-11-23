import { getAuth } from "@clerk/express";
import { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../../domain/errors/error";

export const authenticationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
    const auth = getAuth(req);
    console.log(auth);
    //console.log("userId",auth.userId);
    if (!auth.userId) {
        throw new UnauthorizedError("Unauthorized");
    }
    next();
};
