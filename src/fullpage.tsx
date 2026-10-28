import 'lib/load-perf/start';
import './main.css';

import React from 'react';

import { createRoot } from 'react-dom/client';

import { App } from 'app/App';
import { WindowType } from 'app/env';
import { markLoad } from 'lib/load-perf';

markLoad('entry-evaluated');

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App env={{ windowType: WindowType.FullPage }} />);
