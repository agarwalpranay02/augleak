import { useState } from "react";
import { exposure } from "../core/stats";
import { pct } from "./util";

export function Exposure() {
  const [photos, setPhotos] = useState(1000);
  const [k, setK] = useState(8);
  const [test, setTest] = useState(20);
  const N = photos * k;
  const nTrain = Math.round(N * (1 - test / 100));
  const q = exposure(N, nTrain, k);
  const row = [2, 4, 8, 16, 32];
  return (
    <div className="panel">
      <p className="panel-intro">
        If a release ships every photograph with copies and you split it at random, how many test images have a copy in training?
        The answer depends only on the number of copies and the test share (Proposition 1 in the paper).
      </p>
      <div className="calc">
        <label>Original photographs<input type="number" min={2} value={photos} onChange={(e) => setPhotos(Math.max(2, Number(e.target.value) || 2))} /></label>
        <label>Images per photograph, original included<input type="number" min={1} max={200} value={k} onChange={(e) => setK(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} /></label>
        <label>Test share (%)<input type="number" min={1} max={90} value={test} onChange={(e) => setTest(Math.max(1, Math.min(90, Number(e.target.value) || 20)))} /></label>
      </div>
      <div className="verdict">
        <p className="verdict-num">{pct(q, 1)}</p>
        <p className="verdict-text">of the {Math.round(N * test / 100).toLocaleString()} test images would have at least one copy in the training set.</p>
      </div>
      <table className="exp-table">
        <caption>With a {test}% test share</caption>
        <thead><tr><th scope="col">Images per photograph</th>{row.map((x) => <th scope="col" key={x}>{x}</th>)}</tr></thead>
        <tbody><tr><th scope="row">Test images with a copy in training</th>{row.map((x) => <td key={x}>{pct(exposure(photos * x, Math.round(photos * x * (1 - test / 100)), x), 1)}</td>)}</tr></tbody>
      </table>
      <p className="note">Exposure is not the same as inflation: a copy that is hard to recognise helps the model little. The paper measures how much the reported accuracy actually changes.</p>
    </div>
  );
}
