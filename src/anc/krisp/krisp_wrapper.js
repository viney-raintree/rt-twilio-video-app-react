let Krisp = null;
export async function makeKrisp() {
  if (!Krisp) {
    const krispModulePath = '/krisp/krispsdk.mjs';
    console.log('loading krisp sdk');
    const KrispModule = await import(/* webpackIgnore: true */ krispModulePath);
    Krisp = KrispModule.default;
    console.log('done loading krisp sdk');
    return Krisp;
  }
}
