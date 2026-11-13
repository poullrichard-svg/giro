export type TxType = 'income' | 'expense';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TxType;
  category: string;
  paymentMethod: string;
  date: string; // YYYY-MM-DD
  vehicleId?: string | null;
}

/** Conta fixa (recorrente todo mês). Tabela: fixed_transactions */
export interface FixedBill {
  id: string;
  description: string;
  amount: number;
  type: TxType;
  category: string;
  dueDay?: number | null;
}

/** Marca uma conta fixa como paga/recebida em um mês. Tabela: fixed_payments */
export interface FixedPayment {
  id: string;
  fixedId: string;
  month: string; // YYYY-MM
  amount: number;
  paidAt: string;
}

export type DriverApp = 'Uber' | '99' | 'InDrive' | 'Particular' | 'Outro';

export interface DriverSession {
  id: string;
  date: string;
  app: DriverApp;
  amount: number;
  trips: number;
  kmDriven: number;
  hoursWorked: string; // HH:mm
  fuelSpent: number;
  foodSpent: number;
  fuelConsumption: number;
  observation?: string | null;
  vehicleId?: string | null;
}

export type VehicleOwnership = 'owned' | 'financed' | 'rented';

export interface Vehicle {
  id: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  plate: string;
  color?: string | null;
  renavam?: string | null;
  fuelType: string;
  ownership: VehicleOwnership;
  odometer: number;
  fuelConsumption: number; // km/l
  ipvaValue: number;
  ipvaDueDate?: string | null;
  licensingValue: number;
  licensingDueDate?: string | null;
  insuranceValue: number; // mensal
  insuranceDueDate?: string | null;
  installmentValue: number; // parcela do financiamento ou aluguel semanal->mensal
  installmentsRemaining?: number | null;
  oilIntervalKm: number;
  lastOilChangeKm?: number | null;
  notes?: string | null;
  active: boolean;
}

export interface VehicleExpense {
  id: string;
  vehicleId: string;
  date: string;
  category: string;
  amount: number;
  odometer?: number | null;
  liters?: number | null;
  description?: string | null;
}

export type GoalType = 'financial' | 'activity';

export interface Goal {
  id: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  type: GoalType;
  deadline?: string | null;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  completed: boolean;
}
