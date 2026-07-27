/* Pure bucket arithmetic — no I/O, so it can be unit-tested directly.
   Shared by loadBudgetSnapshot (lib/budget.js) and the bucket math test. */

export function bucketOf(e) {
  return e.bucket || 'daily'
}

function sum(rows, key) {
  return rows.reduce((s, r) => s + (Number(r[key]) || 0), 0)
}

// Split a month's rows into the four buckets and total each. Day-logs count as
// Daily Spend; commitment instances are already this-month-only. The four
// totals always add up to `spent`, so main − spent stays exact.
export function splitByBucket({ monthExpenses = [], dailyLogs = [], commitmentInstances = [] }) {
  const dailyExpenses = monthExpenses.filter(e => bucketOf(e) === 'daily')
  const groceryExpenses = monthExpenses.filter(e => bucketOf(e) === 'groceries')
  const billsExpenses = monthExpenses.filter(e => bucketOf(e) === 'bills')

  const dailyLogsTotal = sum(dailyLogs, 'total_spent')
  const dailyTotal = sum(dailyExpenses, 'amount') + dailyLogsTotal
  const groceriesTotal = sum(groceryExpenses, 'amount')
  const billsTotal = sum(billsExpenses, 'amount')
  const commitmentsTotal = sum(commitmentInstances, 'amount')

  const spent = dailyTotal + groceriesTotal + billsTotal + commitmentsTotal

  return {
    dailyExpenses, groceryExpenses, billsExpenses,
    dailyLogsTotal, dailyTotal, groceriesTotal, billsTotal, commitmentsTotal,
    spent,
    bucketTotals: {
      daily: dailyTotal,
      groceries: groceriesTotal,
      bills: billsTotal,
      commitments: commitmentsTotal,
    },
  }
}
