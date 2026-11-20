
const crypto = require("crypto");

const tickets = new Map();

const createFleetTicket = (adminId) => {
  // Remove expired tickets.
  const now = Date.now();

  for (const [ticket, data] of tickets.entries()) {
    if (data.expiresAt <= now) {
      tickets.delete(ticket);
    }
  }

  const ticket = crypto.randomBytes(32).toString("hex");

  tickets.set(ticket, {
    adminId: adminId.toString(),
    expiresAt: now + 60 * 1000
  });

  return ticket;
};

const consumeFleetTicket = (ticket) => {
  const data = tickets.get(ticket);

  // One-time use: delete before returning.
  tickets.delete(ticket);

  if (!data || data.expiresAt <= Date.now()) {
    return null;
  }

  return data;
};

module.exports = {
  createFleetTicket,
  consumeFleetTicket
};
