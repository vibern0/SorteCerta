export class AnalyticsBrowser {
  load() {
    return Promise.resolve(true);
  }

  identify() {
    return Promise.resolve();
  }

  track() {
    return Promise.resolve();
  }
}
