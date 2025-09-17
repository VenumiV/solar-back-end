import { solarUnits } from "../infrastructure/data.js";
import { v4 as uuidv4 } from "uuid";//random id createing function

export const getAllSolarUnits = async (req, res) => {
  res.status(200).json(solarUnits);
};

export const createSolarUnit = async (req, res) => {
  const { userId, serialNumber, installationDate, capacity, status } = req.body;

  const newSolarUnit = {
    _id: uuidv4(),
    userId,
    serialNumber,
    installationDate,
    capacity,
    status,
  };

  solarUnits.push(newSolarUnit);
  res.status(201).json(newSolarUnit);
};

export const getSolarUnitById = async (req, res) => {
  const { id } = req.params;
  const solarUnit = solarUnits.find((solarUnit) => solarUnit._id === id);

  if (!solarUnit) {
    return res.status(404).json({ message: "Solar unit not found" });
  }
  res.status(200).json(solarUnit);
};

export const updateSolarUnit = async (req, res) => {
  const { id } = req.params;
  const { userId, serialNumber, installationDate, capacity, status } = req.body;
  const solarUnit = solarUnits.find((solarUnit) => solarUnit._id === id);

  if (!solarUnit) {
    return res.status(404).json({ message: "Solar unit not found" });
  }

  solarUnit.userId = userId;
  solarUnit.serialNumber = serialNumber;
  solarUnit.installationDate = installationDate;
  solarUnit.capacity = capacity;
  solarUnit.status = status;

  res.status(200).json(solarUnit);
};

export const deleteSolarUnit = async (req, res) => {
  const { id } = req.params;
  const idx = solarUnits.findIndex((solarUnit) => solarUnit._id === id);//find the index of the deteleting  index

  if (idx === -1) {
    return res.status(404).json({ message: "Solar unit not found" });
  }

  solarUnits.splice(idx, 1);//Remove the idx one from the array
  res.status(204).send();
};