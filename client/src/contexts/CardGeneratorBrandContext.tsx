import { createContext, useContext } from "react";
import {
  getCardGeneratorBrandConfig,
  type CardGeneratorBrandConfig,
} from "@shared/cardGeneratorBrand";

export const CardBrandContext = createContext<CardGeneratorBrandConfig>(
  getCardGeneratorBrandConfig("aaus"),
);

export function useCardBrand() {
  return useContext(CardBrandContext);
}
