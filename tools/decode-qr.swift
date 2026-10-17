// Decodes the QR code on a rendered template page, so the code can be checked
// by machine instead of by eye — a QR that is subtly wrong looks completely fine.
//
//   sips -s format png --resampleWidth 2448 pdf/chess-cornell-dots-white-view-a4.pdf \
//        --out /tmp/page.png
//   swiftc -O tools/decode-qr.swift -o /tmp/decode && /tmp/decode /tmp/page.png
//
// The payload must come back as the full repository URL. Build it outside the
// repository, as above: the binary is not meant to be committed.

import Foundation
import Vision
import AppKit

let path = CommandLine.arguments[1]
guard let img = NSImage(contentsOfFile: path),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("could not load image"); exit(1)
}
let request = VNDetectBarcodesRequest()
request.symbologies = [.qr]
try VNImageRequestHandler(cgImage: cg, options: [:]).perform([request])
guard let results = request.results, !results.isEmpty else {
    print("NO BARCODE DETECTED"); exit(2)
}
for r in results {
    print("symbology: \(r.symbology.rawValue)")
    print("payload  : \(r.payloadStringValue ?? "<none>")")
    print("confidence: \(r.confidence)")
}
