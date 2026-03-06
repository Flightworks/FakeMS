# OPTASK Report

Welcome to the OPTASK overview. This document provides fake data related to various operational tasks including Surface, Comms, and more.

## Quick Links
- [OPTASK Surface](#optask-surface)
- [OPTASK Comms](#optask-comms)
- [OPTASK Air](#optask-air)

---

## OPTASK Surface

| Vessel ID | Type | Status | Lat | Lon | Last Updated |
|-----------|------|--------|-----|-----|--------------|
| VSL-01 | Frigate | Active | 45.12 | -12.34 | 2026-03-06 05:00Z |
| VSL-02 | Destroyer| Patrol | 45.45 | -11.90 | 2026-03-06 05:15Z |
| SUB-09 | Submarine| Stealth| 46.01 | -12.05 | 2026-03-06 04:30Z |

The surface situation requires continuous monitoring. Refer to the [OPTASK Comms](#optask-comms) section for communication protocols.

---

## OPTASK Comms

| Frequency | Channel | Purpose | Encryption |
|-----------|---------|---------|------------|
| 156.800 MHz | CH16 | Distress/Calling | None (Clear) |
| 243.000 MHz | Guard | Military Distress | UHF/Secure |
| SATCOM 1 | Net A | Tactical Coord | Type 1 |

Ensure all tactical coordination is done on encrypted channels.

---

## OPTASK Air

| Air Asset | Role | Altitude | Speed (kts) | Fuel Status |
|-----------|------|----------|-------------|-------------|
| H-60 | ASW | 1000 ft | 120 | 65% |
| P-8A | MPRA | 15000 ft | 350 | 80% |

All air assets must check in on Net A prior to entering the AO. See [Surface Operations](#optask-surface) for surface deconfliction.
