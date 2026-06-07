'use strict';
const crypto = require('crypto');
const { db } = require('../db');
const { findUserByEmail, publicUser } = require('../helpers');

function createSalesUser({ actor, input }) {
  if (!actor || actor.role !== 'admin') throw new Error('Only admins can add sales users');
  const { email, password, name, phone } = input || {};
  if (!email || !password) throw new Error('Missing email/password');
  const em = String(email).trim().toLowerCase();
  if (!em.includes('@')) throw new Error('Invalid email');
  if (String(password).length < 6) throw new Error('Password must be at least 6 characters');
  if (findUserByEmail(em)) throw new Error('Email already registered');
  const newUser = {
    id: crypto.randomUUID(),
    email: em,
    password: String(password),
    role: 'sales',
    name: name ? String(name).trim() : undefined,
    phone: phone ? String(phone).trim() : undefined,
  };
  db.get('users').push(newUser).write();
  return { user: publicUser(newUser) };
}

module.exports = { createSalesUser };
