var assert = require('assert');
var Buffer = require('buffer').Buffer;
var x64 = require('./');

var Asm = x64.Asm;

//
// ### function cmp (dst, src)
// #### @dst {String|Array} General purpose register or memory location
// #### @src {String|Array} General purpose register or memory location
// Compare two arguments and set flags.
//
Asm.prototype.cmp = Asm.prototype._binOp({
  raxImm: 0x3d,
  imm: 0x81,
  immByte: 0x83,
  immMode: 7,
  mr: 0x39,
  rm: 0x3b
});

//
// ### function test (dst, src)
// #### @dst {String|Array} General purpose register or memory location
// #### @src {String} General purpose register
// Test if two arguments have bits in common and set flags
//
Asm.prototype.test = Asm.prototype._binOp({
  binary: true,
  raxImm: 0xa9,
  raxImmByte: 0xa8,
  imm: 0xf7,
  immByte: 0xf6,
  immMode: 0,
  mr: 0x85,
  rm: null
});

var jccOpcodes = {
  a: 0x77, ae: 0x73, b: 0x72, be: 0x76, c: 0x72, cxz: 0xe3,
  e: 0x74, g: 0x7f, ge: 0x7d, l: 0x7c, le: 0x7e, na: 0x76, nae: 0x72,
  nb: 0x73, nbe: 0x77, nc: 0x73, ne: 0x75, ng: 0x7e, nge: 0x7c,
  nl: 0x7d, nle: 0x7f, no: 0x71, np: 0x7b, ns: 0x79, nz: 0x75,
  o: 0x70, p: 0x7a, pe: 0x7a, po: 0x7b, s: 0x78, z: 0x74,

  mp: 0xeb
};

var jccLongOpcodes = {
  a: 0x87, ae: 0x83, b: 0x82, be: 0x86, c: 0x82,
  e: 0x84, g: 0x8f, ge: 0x8d, l: 0x8c, le: 0x8e, na: 0x86, nae: 0x82,
  nb: 0x83, nbe: 0x87, nc: 0x83, ne: 0x85, ng: 0x8e, nge: 0x8c,
  nl: 0x8d, nle: 0x8f, no: 0x81, np: 0x8b, ns: 0x89, nz: 0x85,
  o: 0x80, p: 0x8a, pe: 0x8a, po: 0x8b, s: 0x88, z: 0x84,

  mp: 0xe9
};

//
// ### function j (cond, name)
// #### @cond {String} **optional** Jump condition (see jccOpcodes from above)
// #### @name {String} Label or label name (if inside the label scope)
// Short ump to the label if condition mets (or unconditionally, if no condition
// was given).
//
Asm.prototype.j = function j(cond, name) {
  // j('label')
  if (!name) {
    name = cond;
    cond = 'mp';
  }

  var label = this.label(name);
  var opcode = jccOpcodes[cond];

  assert(opcode, 'Uknown jump cond: ' + cond);
  this.emitb(opcode);
  this.emitb(0xaa);
  label.use(1, -1);
};

//
// ### function jl (cond, name)
// #### @cond {String} **optional** Jump condition (see jccOpcodes from above)
// #### @name {String} Label or label name (if inside the label scope)
// Far jump to the label if condition mets (or unconditionally, if no condition
// was given).
//
Asm.prototype.jl = function jl(cond, name) {
  // jl('label')
  if (!name) {
    name = cond;
    cond = 'mp';
  }

  var label = this.label(name);
  var opcode = jccLongOpcodes[cond];

  assert(opcode, 'Uknown jump cond: ' + cond);
  if (cond !== 'mp')
    this.emitb(0x0f);
  this.emitb(opcode);
  this.emitl(0xdeadbeef);
  label.use(4, -4);
};

//
// ### function tailCall (cond, name)
// #### @src {String|Array} General purpose register or memory location
// Far jump to the specific memory address
//
Asm.prototype.tailCall = function tailCall(src) {
  this.optrexw(null, src);
  this.emitb(0xff);
  this.modrm(4, src);
};

var setOpcodes = {
  a: 0x97, ae: 0x93, b: 0x92, be: 0x96, c: 0x92,
  e: 0x94, g: 0x9f, ge: 0x9d, l: 0x9c, le: 0x9e, na: 0x96, nae: 0x92,
  nb: 0x93, nbe: 0x97, nc: 0x93, ne: 0x95, ng: 0x9e, nge: 0x9c,
  nl: 0x9d, nle: 0x9f, no: 0x91, np: 0x9b, ns: 0x99, nz: 0x95,
  o: 0x90, p: 0x9a, pe: 0x9a, po: 0x9b, s: 0x99, z: 0x94
};

//
// ### function set (cond, dst)
// #### @cond {String} Set condition (see setOpcodes from above)
// #### @dst {String} Destination register/memory
// #### @src {String|Array} General purpose register or memory location
// Set `dst` to 1 or 0 based on condition
//
Asm.prototype.set = function set(cond, dst) {
  var opcode = setOpcodes[cond];

  assert(opcode, 'Uknown set cond: ' + cond);
  this.optrexw(null, dst);
  this.emitb(0x0f);
  this.emitb(opcode);
  this.modrm(0, dst);
};

var cmovOpcodes = {
  a: 0x47, ae: 0x43, b: 0x42, be: 0x46, c: 0x42,
  e: 0x44, g: 0x4f, ge: 0x4d, l: 0x4c, le: 0x4e, na: 0x46, nae: 0x42,
  nb: 0x43, nbe: 0x47, nc: 0x43, ne: 0x45, ng: 0x4e, nge: 0x4c,
  nl: 0x4d, nle: 0x4f, no: 0x41, np: 0x4b, ns: 0x49, nz: 0x45,
  o: 0x40, p: 0x4a, pe: 0x4a, po: 0x4b, s: 0x49, z: 0x44
};

//
// ### function cmov (cond, dst, src)
// #### @cond {String} Set condition (see setOpcodes from above)
// #### @dst {String} Destination register/memory
// Set `dst` to 1 or 0 based on condition
//
Asm.prototype.cmov = function cmov(cond, dst, src) {
  var opcode = cmovOpcodes[cond];

  assert(opcode, 'Uknown set cond: ' + cond);
  this.rexw(dst, src);
  this.emitb(0x0f);
  this.emitb(opcode);
  this.modrm(dst, src);
};

//
// ### function call (dst, name)
// #### @dst {String|Array} General purpose register or memory address to use
//                          as a call target
// #### @name {String} Label or label name (if inside the label scope)
// Push return address on stack and invoke procedure specified by `dst` or
// `name` (NOTE: That actual address of label will be placed into the `dst`).
//
Asm.prototype.call = function call(dst, name) {
  if (name) {
    this.mov(dst, new Buffer([0xde, 0xad, 0xbe, 0xef, 0xde, 0xad, 0xbe, 0xef]));
    this.label(name).use(8, 0, true);
  }

  this.optrexw(null, dst);
  this.emitb(0xff);
  this.modrm(2, dst);
};
