// 皮肤 manifest 的 ed25519 验签公钥(SPKI PEM)。
// 对应私钥只在离线机器上保管,不在仓库中。
export const OKKSKIN_PUBKEY = process.env.OKKSKIN_PUBKEY_OVERRIDE ||
`-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAsJliUf0LyLC2cS+pjBWf4jshxaiiPulvpvUeQX6sruw=
-----END PUBLIC KEY-----`;
