import Foundation
#if canImport(FoundationModels)
import FoundationModels
#endif

@objcMembers
public class AI: NSObject {
    public static let shared = AI()

    /// Streams an on-device Foundation Models response.
    /// - Parameters:
    ///   - prompt: The user prompt.
    ///   - onChunk: Called on the main actor with the cumulative response so far.
    ///   - onComplete: Called once when the stream finishes. `nil` means success;
    ///     a non-nil value is an error message.
    public func streamResponseFor(
        _ prompt: String,
        onChunk: @escaping (String) -> Void,
        onComplete: @escaping (String?) -> Void
    ) {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            let session = LanguageModelSession()
            Task {
                do {
                    let stream = session.streamResponse(to: prompt)
                    for try await chunk in stream {
                        await MainActor.run { onChunk(chunk) }
                    }
                    await MainActor.run { onComplete(nil) }
                } catch {
                    print("Error generating text: \(error)")
                    let message = error.localizedDescription
                    await MainActor.run { onComplete(message) }
                }
            }
        } else {
            onComplete("Foundation Models requires iOS 26 or later.")
        }
        #else
        onComplete("Foundation Models is not available on this device.")
        #endif
    }
}
