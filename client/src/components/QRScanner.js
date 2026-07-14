import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import './QRScanner.css';

const READER_ID = 'qr-reader-region';

// Modal com leitor de QR Code via câmera.
// onScan recebe o texto decodificado; onClose fecha o modal.
function QRScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const handledRef = useRef(false);

  useEffect(() => {
    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          // Evitar múltiplos disparos para o mesmo scan
          if (handledRef.current) return;
          handledRef.current = true;
          onScan(decodedText);
        },
        () => {
          // Erros de leitura frame a frame são normais; ignorar
        }
      )
      .catch((err) => {
        console.error('Erro ao iniciar câmera:', err);
        alert('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
        onClose();
      });

    return () => {
      const s = scannerRef.current;
      if (s) {
        // stop() rejeita se o scanner ainda não iniciou; ignorar
        s.stop().then(() => s.clear()).catch(() => {});
      }
    };
  }, [onScan, onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal qr-scanner-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Escanear QR Code</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <p className="qr-scanner-hint">
          Aponte a câmera para o QR Code da etiqueta do equipamento.
        </p>
        <div id={READER_ID} className="qr-reader-region" />
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default QRScanner;
