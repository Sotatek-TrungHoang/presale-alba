# Alba — Game Lifecycle State Machine (as-coded)

**Date:** 2026-06-19
**Scope:** `alba-social-backend-main/src/games/games.service.ts`, `src/games/dto/*`, `prisma/schema.prisma`.
**Method:** Reverse-engineer trạng thái + transition từ source thật, mọi cạnh có dẫn chứng `file:line`. Mô tả đúng hành vi **đã code**, có ghi rõ chỗ **chưa enforce**.

> Diagram dùng Mermaid v11. Có 2 máy trạng thái độc lập nhưng liên kết: **(A) Game status** và **(B) Player status**. Một sự kiện player (duyệt/accept) là trigger cho transition game.

---

## A. Game status machine

Enum `GameStatus` (`schema.prisma:428-434`): `PLAYERS_REQUIRED`, `READY_TO_BOOK`, `READY`, `COMPLETED`, `CANCELLED`.

```mermaid
stateDiagram-v11
    [*] --> PLAYERS_REQUIRED: createGame()<br/>players_current < players_needed<br/>(games.service.ts:84-87)
    [*] --> READY_TO_BOOK: createGame()<br/>players_current >= players_needed<br/>(seed invited đủ chỗ)

    PLAYERS_REQUIRED --> READY_TO_BOOK: approvePlayer() / acceptInvite()<br/>players_current == players_needed<br/>(:561-569, :245-253)
    READY_TO_BOOK --> PLAYERS_REQUIRED: updateGame() tăng players_needed<br/>(:1275-1285)

    READY_TO_BOOK --> READY: confirmGameDetails()<br/>có đủ exact_time + total_cost + cost_per_player<br/>(:707-722)
    READY_TO_BOOK --> READY_TO_BOOK: confirmGameDetails() thiếu field<br/>(giữ nguyên status)

    READY --> COMPLETED: completeGame()<br/>chỉ creator + game.date <= hôm nay (London tz)<br/>(:767-790, :813)

    COMPLETED --> [*]: payout flow (hold 7d lần đầu + complaint gate)

    CANCELLED --> [*]
    note right of CANCELLED
        CANCELLED có trong enum nhưng
        KHÔNG có endpoint cancelGame()
        → trạng thái không reachable
        (gap: PAY high-sev, không refund-on-cancel)
    end note
```

### Bảng transition (game)
| Từ | Tới | Điều kiện | Ai | Evidence |
|----|-----|-----------|-----|----------|
| `[*]` | PLAYERS_REQUIRED | `players_current < players_needed` lúc tạo | creator | `games.service.ts:84-87` |
| `[*]` | READY_TO_BOOK | seed đủ chỗ ngay khi tạo | creator | `:84-87` |
| PLAYERS_REQUIRED | READY_TO_BOOK | duyệt/accept làm `players_current == players_needed` | creator / invitee | `:561-569`, `:245-253` |
| READY_TO_BOOK | PLAYERS_REQUIRED | update tăng `players_needed` | creator | `:1275-1285` |
| READY_TO_BOOK | READY | confirm đủ `exact_time`+`total_cost`+`cost_per_player` | creator | `:707-722` |
| READY | COMPLETED | complete + ngày đã qua | creator | `:767-790`, `:813` |
| * | CANCELLED | **không có path code** | — | (gap) |

---

## B. Player status machine

Enum `PlayerStatus` (`schema.prisma:436-441`): `PENDING`, `APPROVED`, `REJECTED`, `INVITED`.
Enum `InviteStatus` (`schema.prisma:443-448`): `PENDING`, `ACCEPTED`, `DECLINED`, `NOT_INVITED`.

```mermaid
stateDiagram-v11
    [*] --> APPROVED_creator: createGame()<br/>creator auto-APPROVED, has_approved=true<br/>players_current=1 (:47-66)

    [*] --> PENDING: joinGame()<br/>game ∈ {PLAYERS_REQUIRED, READY_TO_BOOK}<br/>players_current KHÔNG tăng (:390-403)
    [*] --> INVITED: createGame(invited_users[])<br/>invite_status=PENDING (:68-76)

    PENDING --> APPROVED: approvePlayer()<br/>chỉ creator + players_current < players_needed<br/>players_current++ + add vào chat (:506-570)
    PENDING --> REJECTED: rejectPlayer()<br/>soft-delete (deleted_at) + gỡ khỏi chat (:486-505)

    INVITED --> APPROVED: respondInvite(ACCEPT)<br/>invite_status=ACCEPTED, players_current++ (:229-290)
    INVITED --> REJECTED: respondInvite(DECLINE)<br/>invite_status=DECLINED + soft-delete (:220-228)

    REJECTED --> PENDING: joinGame() lại<br/>(:378-384 cho phép, NHƯNG unique index<br/>(user_id,game_id) bỏ qua deleted_at → vỡ unique, bug DB-06)

    APPROVED --> APPROVED: confirm/complete → has_paid<br/>(player trả tiền: cost_per_player + 10% fee)

    note left of APPROVED_creator
        Creator luôn has_paid=true,
        payment_amount=0 (:666-675, :793-809)
    end note
```

### Bảng transition (player)
| Từ | Tới | Điều kiện | Evidence |
|----|-----|-----------|----------|
| `[*]` | APPROVED (creator) | tạo game, tự duyệt | `:47-66` |
| `[*]` | PENDING | join, game OPEN-ish, không tăng `players_current` | `:390-403` |
| `[*]` | INVITED | được mời lúc tạo | `:68-76` |
| PENDING | APPROVED | creator duyệt, còn chỗ | `:506-570` |
| PENDING | REJECTED | creator từ chối → soft-delete | `:486-505` |
| INVITED | APPROVED | accept invite | `:229-290` |
| INVITED | REJECTED | decline invite → soft-delete | `:220-228` |
| REJECTED | PENDING | xin join lại | `:378-384` ⚠️ vỡ unique (DB-06) |

---

## C. Invariant & rule gắn với state

| Invariant | Enforce? | Evidence |
|-----------|:--:|----------|
| `players_needed >= 1` | ✅ | `:49-51` |
| Duyệt không vượt `players_needed` | ✅ | `:507-510` |
| Không join 2 lần (status != REJECTED) | ✅ | `:378-384` |
| Join chỉ khi game ∈ {PLAYERS_REQUIRED, READY_TO_BOOK} | ✅ | `:369-376` |
| Chỉ creator được approve/reject/confirm/complete | ✅ | `:466-470`, `:637-639`, `:767-769` |
| Complete cần `READY` + ngày đã qua | ✅ | `:772-790` |
| Tất cả player non-refunded `has_paid` trước payout | ✅ | `:1459-1473` |
| Hold 7 ngày payout lần đầu | ✅ | `:2099-2102` |
| Complaint PENDING/IN_REVIEW chặn payout | ✅ | `:1445-1449` |
| `players_current` update atomic | ⚠️ một phần | approve path KHÔNG tx (DB-04, `:230-272`); join path CÓ tx |
| Hủy game + refund | ❌ chưa code | (gap, PAY high-sev) |
| `cost_per_player` > 0 | ❌ không validate | có thể 0/âm |

---

## D. Gap nổi bật từ state machine (cross-ref các phase)

1. **CANCELLED không reachable** → không có flow hủy + refund-on-cancel (kẹt tiền). → Phase 2 (payments).
2. **REJECTED → PENDING vỡ unique** do soft-delete không nằm trong unique index. → Phase 3 / DB-06.
3. **Approve path không transactional** → `players_current` drift. → Phase 3 / DB-04.
4. **Không validate cost** ở confirm. → Phase 6 (input validation) / Phase 5 (ValidationPipe whitelist).

## Open questions
- CANCELLED: cần implement `cancelGame()` + refund cho go-live hay defer? (liên quan PAY high-sev)
- REJECTED→PENDING rejoin: cho phép rejoin (cần fix unique partial index) hay cấm hẳn?
