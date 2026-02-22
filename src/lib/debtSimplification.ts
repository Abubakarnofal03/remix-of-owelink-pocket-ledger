export interface Settlement {
  from: string; // member id who pays
  to: string;   // member id who receives
  amount: number;
}

/**
 * Calculate net balances and minimize transactions to settle all debts.
 * 
 * @param expenses - Array of { paidByMemberId, amount, memberCount } for equal splits
 * @param members - Array of member IDs participating
 * @returns Array of settlements (who pays whom, how much)
 */
export function simplifyDebts(
  balances: Map<string, number> // memberId -> net balance (positive = owed money, negative = owes money)
): Settlement[] {
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  balances.forEach((balance, id) => {
    if (balance > 0.01) {
      creditors.push({ id, amount: balance });
    } else if (balance < -0.01) {
      debtors.push({ id, amount: -balance }); // make positive
    }
  });

  // Sort descending by amount for greedy matching
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditors[ci].amount, debtors[di].amount);
    if (amount > 0.01) {
      settlements.push({
        from: debtors[di].id,
        to: creditors[ci].id,
        amount: Math.round(amount * 100) / 100,
      });
    }

    creditors[ci].amount -= amount;
    debtors[di].amount -= amount;

    if (creditors[ci].amount < 0.01) ci++;
    if (debtors[di].amount < 0.01) di++;
  }

  return settlements;
}

/**
 * Calculate net balances from a list of group expenses.
 */
export function calculateBalances(
  expenses: { paid_by_member_id: string; amount: number; split_type: string; split_details: any }[],
  memberIds: string[]
): Map<string, number> {
  const balances = new Map<string, number>();
  memberIds.forEach(id => balances.set(id, 0));

  for (const expense of expenses) {
    const payerId = expense.paid_by_member_id;
    
    if (expense.split_type === 'equal') {
      const share = expense.amount / memberIds.length;
      // Payer gets credit
      balances.set(payerId, (balances.get(payerId) || 0) + expense.amount);
      // Everyone (including payer) owes their share
      memberIds.forEach(id => {
        balances.set(id, (balances.get(id) || 0) - share);
      });
    } else if (expense.split_type === 'exact' && expense.split_details) {
      // split_details: { memberId: amount, ... }
      balances.set(payerId, (balances.get(payerId) || 0) + expense.amount);
      const details = expense.split_details as Record<string, number>;
      Object.entries(details).forEach(([memberId, amount]) => {
        balances.set(memberId, (balances.get(memberId) || 0) - amount);
      });
    } else if (expense.split_type === 'percentage' && expense.split_details) {
      balances.set(payerId, (balances.get(payerId) || 0) + expense.amount);
      const details = expense.split_details as Record<string, number>;
      Object.entries(details).forEach(([memberId, pct]) => {
        balances.set(memberId, (balances.get(memberId) || 0) - (expense.amount * pct / 100));
      });
    }
  }

  return balances;
}
