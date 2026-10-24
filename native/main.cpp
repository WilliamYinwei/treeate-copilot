#include <QCoreApplication>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLibrary>
#include <QMetaMethod>
#include <QObject>

#include <cstdio>

namespace {
constexpr const char *OutputMarker = "TREEATE_QT_META:";

int writeResult(const QJsonObject &result)
{
    const QByteArray output = QByteArray(OutputMarker) + QJsonDocument(result).toJson(QJsonDocument::Compact) + '\n';
    std::fwrite(output.constData(), 1, static_cast<std::size_t>(output.size()), stdout);
    std::fflush(stdout);
    return 0;
}

QString text(const QByteArray &value)
{
    return QString::fromUtf8(value.constData(), value.size());
}
}

int main(int argc, char *argv[])
{
    QCoreApplication application(argc, argv);
    if (application.arguments().size() != 2) {
        return writeResult({
            { QStringLiteral("status"), QStringLiteral("error") },
            { QStringLiteral("message"), QStringLiteral("Usage: treeate-qt-inspector <dll>") }
        });
    }

    QLibrary library(application.arguments().at(1));
    library.setLoadHints(QLibrary::ResolveAllSymbolsHint | QLibrary::PreventUnloadHint);
    if (!library.load()) {
        return writeResult({
            { QStringLiteral("status"), QStringLiteral("error") },
            { QStringLiteral("message"), library.errorString() }
        });
    }

    using CreateDeviceInst = QObject *(*)();
    const auto createDeviceInst = reinterpret_cast<CreateDeviceInst>(library.resolve("CreateDeviceInst"));
    if (!createDeviceInst) {
        return writeResult({
            { QStringLiteral("status"), QStringLiteral("unsupported") },
            { QStringLiteral("reason"), QStringLiteral("CreateDeviceInst export was not found") }
        });
    }

    QObject *instance = createDeviceInst();
    if (!instance) {
        return writeResult({
            { QStringLiteral("status"), QStringLiteral("error") },
            { QStringLiteral("message"), QStringLiteral("CreateDeviceInst returned a null QObject pointer") }
        });
    }

    const QMetaObject *metaObject = instance->metaObject();
    QJsonArray methods;
    const int firstCustomMethod = QObject::staticMetaObject.methodCount();
    for (int index = firstCustomMethod; index < metaObject->methodCount(); ++index) {
        const QMetaMethod method = metaObject->method(index);
        if (method.methodType() != QMetaMethod::Method && method.methodType() != QMetaMethod::Slot) {
            continue;
        }

        const QList<QByteArray> parameterNames = method.parameterNames();
        const QList<QByteArray> parameterTypes = method.parameterTypes();
        QJsonArray parameters;
        for (int parameterIndex = 0; parameterIndex < parameterTypes.size(); ++parameterIndex) {
            parameters.append(QJsonObject {
                { QStringLiteral("name"), parameterIndex < parameterNames.size() ? text(parameterNames.at(parameterIndex)) : QString() },
                { QStringLiteral("type"), text(parameterTypes.at(parameterIndex)) }
            });
        }

        methods.append(QJsonObject {
            { QStringLiteral("name"), text(method.name()) },
            { QStringLiteral("signature"), text(method.methodSignature()) },
            { QStringLiteral("returnType"), method.typeName() ? QString::fromLatin1(method.typeName()) : QString() },
            { QStringLiteral("parameters"), parameters }
        });
    }

    return writeResult({
        { QStringLiteral("status"), QStringLiteral("ok") },
        { QStringLiteral("className"), QString::fromLatin1(metaObject->className()) },
        { QStringLiteral("methods"), methods }
    });
}
