import React, { useMemo } from "react";
import qrcode from "qrcode-generator";
import { G, Path, Rect } from "react-native-svg";
/** ISO QR matrix with four-module quiet zone; never a decorative approximation. */
export function BoardingQrSvg({
  payload,
  x,
  y,
  size,
}: {
  payload: string;
  x: number;
  y: number;
  size: number;
}) {
  const matrix = useMemo(() => {
    const code = qrcode(0, "M");
    code.addData(payload, "Byte");
    code.make();
    const count = code.getModuleCount();
    const cells: string[] = [];
    for (let row = 0; row < count; row++)
      for (let column = 0; column < count; column++) {
        if (code.isDark(row, column))
          cells.push(`M${column + 4} ${row + 4}h1v1h-1z`);
      }
    return { count: count + 8, path: cells.join("") };
  }, [payload]);
  return (
    <G transform={`translate(${x} ${y}) scale(${size / matrix.count})`}>
      <Rect
        x={0}
        y={0}
        width={matrix.count}
        height={matrix.count}
        fill="#FFF"
      />
      <Path d={matrix.path} fill="#07140D" />
    </G>
  );
}
