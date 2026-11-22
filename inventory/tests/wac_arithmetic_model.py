#!/usr/bin/env python3
"""Offline arithmetic model for draft WAC acceptance examples.
Does NOT execute PostgreSQL, Supabase RPCs, RLS or concurrent transactions.
Run: python3 inventory/tests/wac_arithmetic_model.py
"""
from decimal import Decimal, ROUND_HALF_UP

D = Decimal
Q = D("0.000001")
quantity = D("0")
value = D("0")

def receive(purchase_quantity, factor, total_cost):
    global quantity, value
    quantity += D(purchase_quantity) * D(factor)
    value += D(total_cost)

def waste(qty):
    global quantity, value
    qty = D(qty)
    assert D("0") < qty <= quantity
    removed = value if qty == quantity else (value / quantity * qty).quantize(Q, rounding=ROUND_HALF_UP)
    quantity -= qty
    value -= removed

def check(qty, val, avg):
    assert quantity == D(qty), (quantity, qty)
    assert value == D(val), (value, val)
    if avg is not None:
        assert value / quantity == D(avg), (value / quantity, avg)

receive("2", "1000", "400")
check("2000", "400", "0.2")
receive("1", "1000", "500")
check("3000", "900", "0.3")
waste("500")
check("2500", "750", "0.3")
try:
    waste("3000")
except AssertionError:
    pass
else:
    raise AssertionError("Overdraw must fail")
check("2500", "750", "0.3")
waste("2500")
check("0", "0", None)
receive("100", "1", "40")
check("100", "40", "0.4")
print("PASS: offline decimal WAC arithmetic scenarios; PostgreSQL behavior NOT tested")
