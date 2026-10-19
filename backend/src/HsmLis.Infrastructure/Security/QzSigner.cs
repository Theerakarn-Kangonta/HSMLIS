using System.Security.Cryptography;
using System.Text;
using HsmLis.Application.Common;
using Microsoft.Extensions.Options;

namespace HsmLis.Infrastructure.Security;

/// <summary>
/// The certificate and private key for QZ Tray. Each lab PC has the certificate as QZ Tray's override.crt,
/// so it prints without asking when a request carries a signature made with this key.
/// </summary>
public class QzOptions
{
    public const string Section = "Qz";

    /// <summary>PEM certificate. Line breaks may be written as \n, so it fits in one environment variable.</summary>
    public string Certificate { get; set; } = "";
    /// <summary>PEM private key (PKCS#1 or PKCS#8). Never commit a real one.</summary>
    public string PrivateKey { get; set; } = "";
    /// <summary>Only for an encrypted private key.</summary>
    public string PrivateKeyPassword { get; set; } = "";
}

public sealed class QzSigner(IOptions<QzOptions> options) : IQzSigner
{
    public string Certificate()
    {
        var certificate = Pem(options.Value.Certificate);
        if (certificate.Length == 0) throw NotConfigured();
        return certificate;
    }

    public string Sign(string data)
    {
        var o = options.Value;
        var key = Pem(o.PrivateKey);
        if (key.Length == 0) throw NotConfigured();

        using var rsa = RSA.Create();
        try
        {
            if (o.PrivateKeyPassword.Length > 0) rsa.ImportFromEncryptedPem(key, o.PrivateKeyPassword);
            else rsa.ImportFromPem(key);
        }
        catch (Exception e) when (e is ArgumentException or CryptographicException)
        {
            throw NotConfigured();
        }
        // QZ Tray checks SHA-512 with PKCS#1 v1.5 padding (the frontend asks for SHA512).
        var signature = rsa.SignData(Encoding.UTF8.GetBytes(data), HashAlgorithmName.SHA512, RSASignaturePadding.Pkcs1);
        return Convert.ToBase64String(signature);
    }

    private static string Pem(string value) => value.Replace("\\n", "\n").Trim();

    private static BusinessRuleException NotConfigured() =>
        new("qz_not_configured", "Silent printing is not set up on the server: set Qz__Certificate and Qz__PrivateKey.");
}
