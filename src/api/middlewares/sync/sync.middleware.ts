import { NextFunction, Request, Response } from "express";
import { NotFoundError, UnauthorizedError } from "../../../domain/errors/error";
import { clerkClient, getAuth} from "@clerk/express";
import { User } from "../../../infrastructure/entities/User";
import { SolarUnit } from "../../../infrastructure/entities/SolarUnit";

export const syncMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
    const auth = getAuth(req);
    console.log(auth);
    
    const user = await User.findOne({ clerkUserId: auth.userId });
    if(!user){
        throw new NotFoundError("User not found");


    }

    const solarUnits = await SolarUnit.find({ userId: user._id });
    if(solarUnits.length === 0){
        throw new NotFoundError("Solar units not found");
    }

    next();
};