---
name: electron-offline-verification
description: Verify an offline Windows Electron skeleton using actual IPC, resource, process network, and conditional clipboard behavior. Use for desktop foundation validation, not business implementation or release certification.
---

# Electron offline verification

Verify the implemented desktop behavior and leave reproducible evidence tied to its source and runtime. Keep the product's chosen language, behavior, and stage scope.

## Establish the boundary

Read the package lock, launch scripts, preload, and runtime data-root selection. Development Node and Electron's embedded Node are distinct runtimes. Inspect the installed Electron declarations before choosing APIs: in this workspace Electron 45 clipboard reads are asynchronous, and several older inspection APIs are unavailable.

Use fresh, explicitly owned test roots before creating any Electron session. Cover userData, sessionData and logs, not only application JSON. Do not take real data as fixtures. Validate the root, ownership marker and links before cleanup; retain diagnostic runs when cleanup would obscure a failure.

Exercise the real capability bridge from the allowed renderer, an unauthorized window, and malformed inputs. Test filesystem isolation, popup/navigation denial, production developer-tools denial, and manifest-only resources using actual Electron behavior. Configuration text and mocks alone do not prove these boundaries.

## Separate two offline questions

For offline resource availability, put Chromium offline before the first window loads. Describe this as application network emulation, not physical disconnection of Windows or proof that main-process Node cannot connect.

For default network behavior, use a fresh root and observe startup, idle and reopening separately from dependency downloads and development loopback traffic. Capture Chromium NetLog from process launch, supplement it with main-process network diagnostics and a Windows descendant-process/socket observation. Include network-service, renderer and GPU processes. If future code adds Node workers, UDP clients or utility processes, extend observation before extending the conclusion.

Treat observed DNS/HTTP/TCP/UDP activity as a finding even when a webRequest interceptor exists. Hunspell dictionary downloading was found in this workspace with window spellcheck disabled. The validated correction combines the product's Chinese locale with empty spellchecker languages and a disabled session spellchecker. Recheck a blank root; do not generalize the selected locale to unrelated products. Report observation duration and missing systems explicitly.

## Conditional clipboard adapters

When this capability is in scope, use fictional strings and a separate process for replacement and lock-contention tests. Do not read existing user clipboard content as a fixture.

Keep only copySecret and clearIfUnchanged capabilities. A copied generation needs the sequence of the published clipboard: Windows may synthesize formats and change its sequence during CloseClipboard. The clear operation must acquire OpenClipboard and compare generation, sequence and owner in that same held interval before EmptyClipboard. Busy means not cleared; retry only a bounded number of times and revalidate every time. String equality cannot protect another process's identical copy.

An addon linked against Electron's node.lib needs the host-executable delay-load hook when its import names node.exe. Validate loading in the actual Electron main process, not just development Node. Missing compilers are a scoped blocker; do not install system workloads as an implicit fallback.

## Evidence and workspace entrypoints

In Work Station, use `npm run verify` after prerequisites are present. It records source SHA-256 and separate command results under `docs/implementation/evidence`. `npm run audit:deps` is the separate online advisory check; `npm run licenses` regenerates license evidence from installed packages. A package declaration or README is not automatically a standalone license text.

Keep Windows 10, Windows 11, unpacked development runtime and installer/portable results separate. Product modules not yet implemented remain future verification, not empty passing tests. For native Windows UI checks use the available computer-use skill and its current documented API.
