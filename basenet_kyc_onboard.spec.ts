//
// BASENET: KYC-onboard the buyer (and ensure sender/admin is a member) so the
// MARS1 TRANSFER launch purchase passes verifyValidKycTransfer.
//
// membershipKyc has enableMembership=true + enableKyc=true. For an admin->buyer
// RWA transfer to be valid:
//   1) both admin (sender) and buyer (receiver) must be in memberLedger  -> setMember
//   2) buyer must have a memberKyc record (hard failwith otherwise)       -> setMemberKyc
//      (admin already has one). country "NIL" has an unfrozen transfer rule.
//

describe('Basenet — KYC onboard buyer for MARS1 TRANSFER', async () => {
  let utils: Utils;
  let tezos: any;
  let adminPkh: string;
  let kyc: any;
  let st: any;

  before('connect as admin/registrar', async () => {
    const sk = process.env.DEPLOYER_SK;
    if (!sk) throw new Error('DEPLOYER_SK env var required (admin/registrar key)');
    utils = new Utils();
    await utils.init(sk);
    tezos = utils.tezos;
    adminPkh = await tezos.signer.publicKeyHash();
    kyc = await tezos.contract.at(KYC_ADDR);
    st = load();
    st.kycOnboard = st.kycOnboard || {};
    console.log(`\n  admin/registrar: ${adminPkh}`);
    console.log(`  buyer          : ${BUYER}\n`);
  });

  it('setMember: admin + buyer into memberLedger', async () => {
    if (st.kycOnboard.membersSet) {
      console.log('  ↩︎ members already set');
      return;
    }
    const op = await kyc.methods
      .setMember([
        { updateType: 'update', memberAddress: adminPkh, membershipTier: 'none' },
        { updateType: 'update', memberAddress: BUYER, membershipTier: 'none' }
      ])
      .send();
    await op.confirmation(1);
    st.kycOnboard.membersSet = true;
    save(st);
    console.log(`  ✓ setMember admin+buyer  ${op.hash}`);
  });

  it('setMemberKyc: buyer (country/region/investorType = NIL)', async () => {
    if (st.kycOnboard.buyerKyc) {
      console.log('  ↩︎ buyer KYC already set');
      return;
    }
    const op = await kyc.methods
      .setMemberKyc('addMemberKyc', [{ memberAddress: BUYER, country: 'NIL', region: 'NIL', investorType: 'NIL' }])
      .send();
    await op.confirmation(1);
    st.kycOnboard.buyerKyc = true;
    save(st);
    console.log(`  ✓ setMemberKyc buyer  ${op.hash}`);
  });
});
