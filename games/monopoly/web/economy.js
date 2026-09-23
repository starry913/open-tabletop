// Every monetary value uses ten times the original denomination.
export const MONEY_SCALE=10;
export const cash=baseUnits=>baseUnits*MONEY_SCALE;
export const START_CASH=cash(1500),GO_SALARY=cash(200),JAIL_FEE=cash(50);
// Round in the original denomination, preserving the original economic ratios.
export const interest=mortgage=>cash(Math.ceil(mortgage/MONEY_SCALE/10));
export const redemption=mortgage=>mortgage+interest(mortgage);
export const validCash=n=>Number.isSafeInteger(n)&&n>=0&&n%MONEY_SCALE===0;
